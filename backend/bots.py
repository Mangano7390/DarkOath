"""
Dark Oath — bots.

Bots are ordinary players flagged ``is_bot``. The server's ticker asks
``decide()`` what a bot (or an absent human, see AFK takeover) should do in
the current phase, and applies it through the same code path as a human
action, so bots can never break the rules.

The AI is heuristic and role-aware:
  * Fidèles (and the Tyran, who usually knows nobody) build a suspicion score
    from public facts: who sat in governments that enacted Trahison decrees,
    contradictions with their own cards, votes, what the table says in the
    chat, and private investigation / peek results.
  * Traîtres know their allies: they push the Tyran into power after
    3 Trahisons, protect allies, sabotage decrees while trying not to be
    too obvious, and frame Fidèles.

Table talk: every bot has a stable persona (register, talkativeness,
aggressiveness). Bots answer when someone names them, accuses them, asks
about their cards / votes / suspicions, call out a human whose claim
contradicts what they saw, and react to nominations and votes. Lines are
queued with a "typing" delay (``queue_line``) and posted by the server's
ticker (``flush_chat``), so they never arrive all at once.

The module works on the server's pydantic GameState but only reads it,
except for ``memory`` (gs.bot_memory[player_id]) which stores private
knowledge (cards seen, investigation results, claims already made) and
``gs.bot_chat_queue``.
"""
from __future__ import annotations

import random
import re
import unicodedata
import zlib
from typing import Any, Callable, Dict, List, Optional, Tuple

BOT_NAMES = [
    "Sire Aldric", "Dame Isolde", "Frère Anselme", "Baron Godfroy",
    "Dame Mahaut", "Sire Tristan", "Comtesse Aliénor", "Messire Perceval",
    "Dame Ysaline", "Sire Gauvain", "Abbesse Hildegarde", "Chevalier Bertrand",
]
TITLES = {"sire", "dame", "frere", "baron", "comtesse", "messire", "abbesse", "chevalier", "ecuyer"}

LOYAL = "LOYAL"
CONJURE = "CONJURE"
USURPATEUR = "USURPATEUR"

Action = Tuple[str, Dict[str, Any]]


# ----------------------------------------------------------------------
# helpers
# ----------------------------------------------------------------------
def _val(x: Any) -> Any:
    """Enum → raw value."""
    return getattr(x, "value", x)


def _role(p) -> Optional[str]:
    return _val(p.role) if p.role is not None else None


def memory(gs, player) -> Dict[str, Any]:
    mem = gs.bot_memory.get(player.id)
    if mem is None:
        mem = {"investigations": {}, "claims_done": [], "seen": {}, "claims": {}, "grudges": {}}
        gs.bot_memory[player.id] = mem
    for k, default in (("claims", {}), ("grudges", {})):
        mem.setdefault(k, default)
    return mem


def table(gs) -> Dict[str, Any]:
    """Shared, public-knowledge memory (what was said at the table)."""
    tm = gs.bot_memory.get("_table")
    if tm is None:
        tm = {"accused": {}, "said": [], "flags": []}
        gs.bot_memory["_table"] = tm
    return tm


def _alive(gs) -> List[Any]:
    return [p for p in gs.players if p.alive]


def _by_seat(gs, seat):
    return next((p for p in gs.players if p.seat == seat), None)


def _name(gs, seat) -> str:
    p = _by_seat(gs, seat)
    return p.name if p else f"siège {seat}"


def allies(gs, player) -> set:
    """Seats this player *knows* to be on the evil side.

    Traîtres know every Traître and the Tyran. In 5-6 player games the
    Tyran also knows his Traître (Secret Hitler rule).
    """
    r = _role(player)
    if r == CONJURE:
        return {p.seat for p in gs.players if _role(p) in (CONJURE, USURPATEUR) and p.seat != player.seat}
    if r == USURPATEUR and len(gs.players) <= 6:
        return {p.seat for p in gs.players if _role(p) == CONJURE}
    return set()


def tyran_seat(gs) -> Optional[int]:
    t = next((p for p in gs.players if _role(p) == USURPATEUR), None)
    return t.seat if t else None


def _events(gs, kind: str) -> List[Dict[str, Any]]:
    return [e for e in gs.events if e.get("kind") == kind]


def _norm(text: str) -> str:
    text = unicodedata.normalize("NFD", text or "")
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    return text.lower().replace("’", "'")


# ----------------------------------------------------------------------
# persona
# ----------------------------------------------------------------------
def persona(gs, player) -> Dict[str, Any]:
    mem = memory(gs, player)
    if "persona" not in mem:
        rng = random.Random(zlib.crc32(player.id.encode()))
        mem["persona"] = {
            "casual": rng.random() < 0.5,        # familier vs soutenu
            "talk": rng.uniform(0.35, 0.95),      # how often it speaks unprompted
            "aggr": rng.uniform(0.2, 0.9),        # how readily it accuses
        }
    return mem["persona"]


def _pick(gs, player, formal: List[str], casual: Optional[List[str]] = None) -> str:
    pool = casual if (casual and persona(gs, player)["casual"]) else formal
    said = set(table(gs)["said"][-30:])
    fresh = [x for x in pool if x not in said] or pool
    return random.choice(fresh)


def _styled(gs, player, text: str) -> str:
    """Casual bots type like people in a chat: lower-case start, no final dot."""
    if not text or not persona(gs, player)["casual"]:
        return text
    if random.random() < 0.6 and text[0].isupper() and not text.startswith(tuple(p.name for p in gs.players)):
        text = text[0].lower() + text[1:]
    if text.endswith(".") and not text.endswith("..."):
        text = text[:-1]
    return text


# ----------------------------------------------------------------------
# suspicion model (Fidèle / Tyran point of view)
# ----------------------------------------------------------------------
def suspicion(gs, player) -> Dict[int, float]:
    """Higher = more likely a Traître, from this player's point of view."""
    mem = memory(gs, player)
    scores: Dict[int, float] = {p.seat: 0.0 for p in gs.players if p.seat != player.seat}

    decrees = [e for e in _events(gs, "decree") if not e.get("auto")]
    for e in decrees:
        r, c = e.get("regent_seat"), e.get("chambellan_seat")
        bad = e.get("type") == CONJURE
        for seat, w in ((r, 1.0), (c, 1.3)):
            if seat in scores:
                scores[seat] += w if bad else -0.6

        # Contradiction with my own knowledge as King: I passed at least one
        # Loyal decree and my Conseiller enacted a Trahison → he lied.
        seen = mem["seen"].get(str(e.get("turn")))
        if seen and seen.get("role") == "regent" and bad and c in scores:
            if LOYAL in seen.get("passed", []):
                scores[c] += 50.0
        # As Conseiller: I received only Trahisons → the King is suspect.
        if seen and seen.get("role") == "chambellan" and r in scores:
            if seen.get("received") == [CONJURE, CONJURE]:
                scores[r] += 1.5

        # I peeked the 3 cards this government drew: a Loyal was among them
        peek = mem.get("peek")
        if peek and bad and e.get("turn") == peek.get("turn", -9) + 1 and LOYAL in peek.get("cards", []):
            for seat in (r, c):
                if seat in scores:
                    scores[seat] += 1.2

    # Voting for governments that enacted Trahison
    decrees_by_turn = {e.get("turn"): e for e in decrees}
    for v in _events(gs, "vote"):
        if v.get("result") != "elected":
            continue
        d = decrees_by_turn.get(v.get("turn"))
        if not d:
            continue
        for seat_s, ballot in (v.get("ballots") or {}).items():
            seat = int(seat_s)
            if seat in scores and ballot == "oui":
                scores[seat] += 0.25 if d.get("type") == CONJURE else -0.1

    # What the table says (social pressure) and personal grudges
    for seat_s, count in table(gs)["accused"].items():
        seat = int(seat_s)
        if seat in scores:
            scores[seat] += min(0.15 * count, 0.9)
    for seat_s, g in mem["grudges"].items():
        seat = int(seat_s)
        if seat in scores:
            scores[seat] += g

    # Private investigation results
    for seat_s, camp in mem["investigations"].items():
        seat = int(seat_s)
        if seat in scores:
            scores[seat] += 100.0 if camp == "Traître" else -100.0

    # A little personality noise so bots don't all agree
    rng = random.Random(f"{player.id}-{gs.turn.turn_number}")
    for seat in scores:
        scores[seat] += rng.uniform(-0.35, 0.35)
    return scores


def _least_suspect(gs, player, seats: List[int]) -> Optional[int]:
    if not seats:
        return None
    s = suspicion(gs, player)
    return min(seats, key=lambda x: s.get(x, 0.0))


def _most_suspect(gs, player, seats: List[int]) -> Optional[int]:
    if not seats:
        return None
    s = suspicion(gs, player)
    return max(seats, key=lambda x: s.get(x, 0.0))


def _plays_evil(gs, player) -> bool:
    """Does this player act for the Traîtres right now?

    Traîtres always do. The Tyran plays like a Fidèle to stay hidden, and only
    sabotages when the Fidèles are about to win.
    """
    r = _role(player)
    if r == CONJURE:
        return True
    if r == USURPATEUR:
        return gs.tracks.loyal >= 4
    return False


# ----------------------------------------------------------------------
# decisions
# ----------------------------------------------------------------------
def decide(gs, player, eligible_nominees: List[int]) -> Optional[Action]:
    phase = _val(gs.turn.phase)
    t = gs.turn
    if not player.alive:
        return None

    if phase == "NOMINATION" and t.regent_seat == player.seat:
        return ("NOMINATE", {"nomineeSeat": _nominate(gs, player, eligible_nominees)})

    if phase == "VOTE" and player.id not in t.votes:
        return ("VOTE", {"vote": _vote(gs, player)})

    if phase == "LEGIS_REGENT" and t.regent_seat == player.seat and t.legislative_cards:
        return ("DISCARD", {"cardId": _regent_discard(gs, player)})

    if phase == "LEGIS_CHAMBELLAN" and t.legislative_cards:
        if t.veto_requested:
            if t.regent_seat == player.seat:
                return ("VETO_RESPONSE", {"accept": _accept_veto(gs, player)})
            return None
        if t.nominee_seat == player.seat:
            if _wants_veto(gs, player):
                return ("VETO", {})
            return ("DISCARD", {"cardId": _chambellan_pick(gs, player)})

    if phase == "POWER" and t.regent_seat == player.seat:
        if t.active_power == "INVESTIGATE":
            if t.power_result is None:
                return ("INVESTIGATE", {"targetSeat": _investigate_target(gs, player)})
            return ("ACK_POWER", {})
        if t.active_power == "PEEK":
            return ("PEEK", {}) if t.power_result is None else ("ACK_POWER", {})
        if t.active_power == "SPECIAL_ELECTION":
            return ("SPECIAL_ELECTION", {"targetSeat": _special_election_target(gs, player)})
        if t.active_power == "EXECUTE":
            return ("EXECUTE", {"targetSeat": _execute_target(gs, player)})

    if phase == "DEFIANCE" and player.id not in t.defiance_votes:
        return ("DEFIANCE_VOTE", {"targetSeat": _defiance_target(gs, player)})

    if phase == "CONSEIL_ROYAUME" and player.id not in t.conseil_ready:
        return ("CONSEIL_READY", {})

    return None


def _nominate(gs, player, seats: List[int]) -> Optional[int]:
    if not seats:
        return None
    if _role(player) == CONJURE:
        ty = tyran_seat(gs)
        # Victoire immédiate : Tyran Conseiller après 3 Trahisons
        if gs.tracks.conjure >= 3 and ty in seats:
            return ty
        friends = [s for s in seats if s in allies(gs, player)]
        if friends and random.random() < 0.55:
            return random.choice(friends)
        # Otherwise pick a Fidèle who looks clean, to blend in
        return _least_suspect(gs, player, seats)
    return _least_suspect(gs, player, seats)


def _vote(gs, player) -> str:
    t = gs.turn
    r, c = t.regent_seat, t.nominee_seat
    if player.seat in (r, c):
        return "oui"
    friends = allies(gs, player)
    if _role(player) == CONJURE:
        ty = tyran_seat(gs)
        if gs.tracks.conjure >= 3 and c == ty:
            return "oui"
        if r in friends or c in friends:
            return "oui" if random.random() < 0.9 else "non"
        # Blend in: vote like a cautious Fidèle most of the time
        return "oui" if random.random() < 0.55 else "non"

    s = suspicion(gs, player)
    score = max(s.get(r, 0.0), 0) * 0.8 + max(s.get(c, 0.0), 0) * 1.2
    threshold = 1.6
    if gs.tracks.conjure >= 3:
        threshold = 1.0  # the Tyran could win as Conseiller: be strict
    if gs.tracks.crisis >= 2:
        threshold += 1.0  # avoid the Colère du Peuple
    if friends and (r in friends or c in friends):
        threshold += 0.8  # the Tyran quietly helps the Traître he knows
    return "oui" if score < threshold else "non"


def _remember_cards(gs, player, role: str, cards: List[str], passed: List[str]) -> None:
    mem = memory(gs, player)
    key = str(gs.turn.turn_number)
    entry = mem["seen"].setdefault(key, {})
    entry["role"] = role
    if role == "regent":
        entry["drawn"] = cards
        entry["passed"] = passed
    else:
        entry["received"] = cards
        entry["enacted"] = passed[0] if passed else None


def _regent_discard(gs, player) -> int:
    cards = [_val(c) for c in gs.turn.legislative_cards]
    evil = _plays_evil(gs, player)
    if evil:
        sabotage = gs.tracks.loyal >= 3 or gs.tracks.conjure >= 4 or random.random() < 0.75
        target = LOYAL if sabotage else CONJURE
    else:
        target = CONJURE
    idx = cards.index(target) if target in cards else 0
    passed = cards[:idx] + cards[idx + 1:]
    _remember_cards(gs, player, "regent", cards, passed)
    return idx


def _chambellan_pick(gs, player) -> int:
    """Return the index of the card to ENACT (server semantics for LEGIS_CHAMBELLAN)."""
    cards = [_val(c) for c in gs.turn.legislative_cards]
    evil = _plays_evil(gs, player)
    if evil:
        sabotage = gs.tracks.loyal >= 4 or gs.tracks.conjure >= 4 or random.random() < 0.85
        want = CONJURE if sabotage else LOYAL
    else:
        want = LOYAL
    idx = cards.index(want) if want in cards else 0
    _remember_cards(gs, player, "chambellan", cards, [cards[idx]])
    return idx


def _wants_veto(gs, player) -> bool:
    t = gs.turn
    if gs.tracks.conjure < 5 or t.veto_refused:
        return False
    cards = [_val(c) for c in t.legislative_cards]
    if _plays_evil(gs, player):
        return False  # a 6th Trahison wins the game
    return cards.count(CONJURE) == len(cards)


def _accept_veto(gs, player) -> bool:
    if _plays_evil(gs, player):
        return False
    seen = memory(gs, player)["seen"].get(str(gs.turn.turn_number), {})
    passed = seen.get("passed") or [_val(c) for c in gs.turn.legislative_cards]
    # I passed a Loyal and he wants to veto? He's lying: refuse.
    return LOYAL not in passed


def _targets(gs, player) -> List[int]:
    return [p.seat for p in _alive(gs) if p.seat != player.seat]


def _investigate_target(gs, player) -> Optional[int]:
    mem = memory(gs, player)
    done = set(getattr(gs, "investigated_seats", []) or [])
    seats = [s for s in _targets(gs, player) if s not in done and str(s) not in mem["investigations"]]
    seats = seats or [s for s in _targets(gs, player) if s not in done] or _targets(gs, player)
    if _role(player) == CONJURE:
        foes = [s for s in seats if s not in allies(gs, player)]
        return random.choice(foes or seats)
    return _most_suspect(gs, player, seats)


def _special_election_target(gs, player) -> Optional[int]:
    seats = _targets(gs, player)
    friends = [s for s in seats if s in allies(gs, player)]
    if _role(player) == CONJURE and friends and random.random() < 0.7:
        return random.choice(friends)
    return _least_suspect(gs, player, seats)


def _execute_target(gs, player) -> Optional[int]:
    seats = _targets(gs, player)
    if _role(player) == CONJURE:
        foes = [s for s in seats if s not in allies(gs, player)]
        # Kill the Fidèle who is the most trusted (most dangerous for us)
        return _least_suspect(gs, player, foes or seats)
    foes = [s for s in seats if s not in allies(gs, player)]
    return _most_suspect(gs, player, foes or seats)


def _defiance_target(gs, player) -> Optional[int]:
    seats = _targets(gs, player)
    if not seats:
        return None
    if _role(player) == CONJURE:
        foes = [s for s in seats if s not in allies(gs, player)]
        if foes and random.random() < 0.6:
            return _most_suspect(gs, player, foes)
        return None
    s = suspicion(gs, player)
    target = max(seats, key=lambda x: s.get(x, 0.0))
    return target if s.get(target, 0.0) >= 1.2 else None


# ----------------------------------------------------------------------
# chat queue
# ----------------------------------------------------------------------
def queue_line(gs, player, text: Optional[str], now: float, delay: Optional[float] = None,
               quick: bool = False) -> None:
    """Schedule a chat line with a human-like typing delay."""
    if not text:
        return
    text = _styled(gs, player, text)
    if delay is None:
        base = (0.8, 2.0) if quick else (1.5, 4.0)
        delay = random.uniform(*base) + min(len(text) * 0.04, 4.0)
    # never two lines from the same bot within ~3 s
    last = max((q["due"] for q in gs.bot_chat_queue if q["player_id"] == player.id), default=0)
    due = max(now + delay, last + 3.0)
    gs.bot_chat_queue.append({"due": due, "player_id": player.id, "text": text})


def flush_chat(gs, now: float, post: Callable[[Any, str], Any]) -> bool:
    """Post the lines whose time has come. Returns True if something was posted."""
    if not gs.bot_chat_queue:
        return False
    posted = False
    keep = []
    for q in sorted(gs.bot_chat_queue, key=lambda x: x["due"]):
        if q["due"] > now:
            keep.append(q)
            continue
        p = next((x for x in gs.players if x.id == q["player_id"]), None)
        if not p or not p.alive or now - q["due"] > 30:
            continue
        post(p, q["text"])
        tm = table(gs)
        tm["said"] = (tm["said"] + [q["text"]])[-40:]
        posted = True
    gs.bot_chat_queue = keep
    return posted


def _busy(gs, player) -> bool:
    return any(q["player_id"] == player.id for q in gs.bot_chat_queue)


# ----------------------------------------------------------------------
# claims (what bots say about their own cards / powers)
# ----------------------------------------------------------------------
def _fmt_cards(cards: List[str]) -> str:
    n_l = cards.count(LOYAL)
    n_c = cards.count(CONJURE)
    parts = []
    if n_l:
        parts.append(f"{n_l} Loya" + ("ux" if n_l > 1 else "l"))
    if n_c:
        parts.append(f"{n_c} Trahison" + ("s" if n_c > 1 else ""))
    return " et ".join(parts) if parts else "rien"


def decree_claims(gs, player, decree: Dict[str, Any]) -> Optional[str]:
    """What a bot King / Conseiller says right after a decree is revealed."""
    mem = memory(gs, player)
    seen = mem["seen"].get(str(decree.get("turn")))
    if not seen:
        return None
    key = f"claim-{decree.get('turn')}"
    if key in mem["claims_done"]:
        return None
    mem["claims_done"].append(key)
    enacted = decree.get("type")
    evil = _role(player) == CONJURE

    if seen.get("role") == "regent":
        drawn, passed = seen.get("drawn", []), seen.get("passed", [])
        if evil and enacted == CONJURE:
            if random.random() < 0.6:
                drawn, passed = [CONJURE] * 3, [CONJURE] * 2
                text = _pick(gs, player,
                             [f"J'ai pioché {_fmt_cards(drawn)}. Je n'avais aucun choix."],
                             ["3 trahisons en main, j'avais pas le choix", "que du rouge, désolé"])
            else:
                drawn, passed = [LOYAL, CONJURE, CONJURE], [LOYAL, CONJURE]
                text = _pick(gs, player,
                             [f"J'ai pioché {_fmt_cards(drawn)} et j'ai transmis un Loyal… mon Conseiller a choisi la Trahison."],
                             ["j'ai passé un loyal et une trahison. c'est le conseiller qui a choisi"])
        else:
            text = _pick(gs, player,
                         [f"J'ai pioché {_fmt_cards(drawn)} et j'ai transmis {_fmt_cards(passed)}."],
                         [f"pioché {_fmt_cards(drawn)}, passé {_fmt_cards(passed)}"])
        mem["claims"][str(decree.get("turn"))] = {"role": "regent", "drawn": drawn, "passed": passed}
        return text

    received = seen.get("received", [])
    if evil and enacted == CONJURE:
        received = [CONJURE, CONJURE]
        text = _pick(gs, player, ["On ne m'a donné que deux Trahisons. Demandez au Roi pourquoi."],
                     ["j'ai reçu 2 trahisons, demandez au roi", "que du rouge reçu. le roi a gardé le loyal ?"])
    elif enacted == CONJURE and received == [CONJURE, CONJURE]:
        text = _pick(gs, player, ["Je n'ai reçu que deux Trahisons. Le Roi doit s'expliquer."],
                     ["2 trahisons reçues, rien à faire"])
    else:
        text = _pick(gs, player, [f"J'ai reçu {_fmt_cards(received)}."], [f"reçu {_fmt_cards(received)}"])
    mem["claims"][str(decree.get("turn"))] = {"role": "chambellan", "received": received}
    return text


def investigation_claim(gs, player, target_seat: int, camp: str) -> str:
    name = _name(gs, target_seat)
    if _role(player) == CONJURE:
        # Lie to protect allies / frame Fidèles
        if target_seat in allies(gs, player):
            camp = "Fidèle"
        elif random.random() < 0.7:
            camp = "Traître"
    memory(gs, player)["claimed_investigation"] = {"seat": target_seat, "camp": camp}
    if camp == "Traître":
        table(gs)["accused"][str(target_seat)] = table(gs)["accused"].get(str(target_seat), 0) + 2
    return _pick(gs, player, [f"J'ai sondé l'âme de {name} : {camp}."],
                 [f"{name} est {camp}. je l'ai vu de mes yeux", f"enquête sur {name} : {camp}"])


def peek_claim(gs, player, cards: List[str]) -> str:
    shown = list(cards)
    if _role(player) == CONJURE and random.random() < 0.6:
        shown = [CONJURE] * 3  # cover the next government (or frame it)
    memory(gs, player)["claimed_peek"] = shown
    return _pick(gs, player, [f"Les trois prochains décrets : {_fmt_cards(shown)}."],
                 [f"j'ai vu la pioche : {_fmt_cards(shown)}"])


# ----------------------------------------------------------------------
# facts used in table talk
# ----------------------------------------------------------------------
def _reason_against(gs, seat: int) -> Optional[str]:
    """A public fact that makes `seat` look bad, phrased as table talk."""
    name = _name(gs, seat)
    bad_govs = [e for e in _events(gs, "decree")
                if not e.get("auto") and e.get("type") == CONJURE
                and seat in (e.get("regent_seat"), e.get("chambellan_seat"))]
    if len(bad_govs) >= 2:
        return f"{name} était au gouvernement pour {len(bad_govs)} Trahisons. Ça fait beaucoup."
    if bad_govs:
        role = "Conseiller" if bad_govs[-1].get("chambellan_seat") == seat else "Roi"
        return f"{name} était {role} quand la Trahison est passée."
    yes_bad = 0
    decrees_by_turn = {e.get("turn"): e for e in _events(gs, "decree") if not e.get("auto")}
    for v in _events(gs, "vote"):
        d = decrees_by_turn.get(v.get("turn"))
        if v.get("result") == "elected" and d and d.get("type") == CONJURE and (v.get("ballots") or {}).get(str(seat)) == "oui":
            yes_bad += 1
    if yes_bad:
        return f"{name} a voté pour le gouvernement qui a fait passer la Trahison."
    if table(gs)["accused"].get(str(seat), 0) >= 3:
        return f"Je ne suis pas le seul à douter de {name}."
    return None


def _reason_for(gs, seat: int) -> Optional[str]:
    good = [e for e in _events(gs, "decree")
            if not e.get("auto") and e.get("type") == LOYAL
            and seat in (e.get("regent_seat"), e.get("chambellan_seat"))]
    if good:
        return f"{_name(gs, seat)} a fait passer un Loyal au tour {good[-1].get('turn')}."
    return None


def _my_good_record(gs, player) -> Optional[str]:
    good = [e for e in _events(gs, "decree")
            if not e.get("auto") and e.get("type") == LOYAL
            and player.seat in (e.get("regent_seat"), e.get("chambellan_seat"))]
    if good:
        return f"J'ai fait passer un Loyal au tour {good[-1].get('turn')}."
    return None


def _suspect_for_talk(gs, player, exclude: Tuple[int, ...] = ()) -> Optional[int]:
    seats = [s for s in _targets(gs, player) if s not in exclude]
    if _role(player) == CONJURE or allies(gs, player):
        seats = [s for s in seats if s not in allies(gs, player)]
    if not seats:
        return None
    s = suspicion(gs, player)
    ranked = sorted(seats, key=lambda x: -s.get(x, 0.0))[:2]
    return random.choice(ranked)


# ----------------------------------------------------------------------
# reacting to humans
# ----------------------------------------------------------------------
ACCUSE_RE = re.compile(r"traitr|menteu|\bmen[st]\b|mentir|suspect|louche|conjur|tyran|\bsus\b|bizarre|fasciste"
                       r"|mechant|coupable|\bvire|execut|mefie|pas confiance|rouge")
DEFEND_RE = re.compile(r"fidele|confiance|clean|innocent|liberal|\bsafe\b|\bok\b")
CARDS_RE = re.compile(r"carte|pioch|recu|\bpasse|donne|eu quoi|t'?as eu|tu as eu|defauss|t'?avais quoi")
VOTE_RE = re.compile(r"\bvot")
WHO_RE = re.compile(r"\bqui\b|soupcon|tu penses|vous pensez|avis")
GREET_RE = re.compile(r"^(salut|bonjour|coucou|yo|hello|bonsoir|wesh|slt|cc)\b")
ROLE_RE = re.compile(r"t'?es quoi|tu es quoi|ton role|t'?es (fidele|traitre)|tu es (fidele|traitre)|t'?es (gentil|mechant)")
TWO_BAD_RE = re.compile(r"(2|deux|3|trois|que des?|que du) ?(trahison|rouge|fascist)|aucun loyal|pas de loyal|0 loyal")


def _name_keys(p) -> List[str]:
    words = re.findall(r"[a-z0-9]+", _norm(p.name))
    keys = [w for w in words if len(w) >= 3 and w not in TITLES]
    return keys or [_norm(p.name).strip()]


def mentioned_seats(gs, text: str) -> List[int]:
    n = _norm(text)
    found = []
    for p in gs.players:
        for k in _name_keys(p):
            if k and re.search(rf"(?<![a-z0-9]){re.escape(k)}(?![a-z0-9])", n):
                found.append(p.seat)
                break
    return found


def _last_gov_with(gs, seat) -> Optional[Dict[str, Any]]:
    for e in reversed(_events(gs, "decree")):
        if not e.get("auto") and seat in (e.get("regent_seat"), e.get("chambellan_seat")):
            return e
    return None


def _answer_cards(gs, bot) -> str:
    mem = memory(gs, bot)
    d = _last_gov_with(gs, bot.seat)
    if not d:
        return _pick(gs, bot, ["Je n'ai encore été ni Roi ni Conseiller."], ["j'ai pas encore été au gouvernement"])
    claim = mem["claims"].get(str(d.get("turn")))
    if not claim:
        return _pick(gs, bot, ["Je l'ai déjà dit, relisez le chat."], ["déjà dit plus haut"])
    if claim["role"] == "regent":
        return _pick(gs, bot, [f"Je le répète : {_fmt_cards(claim['drawn'])} piochés, {_fmt_cards(claim['passed'])} transmis."],
                     [f"je répète : pioché {_fmt_cards(claim['drawn'])}, passé {_fmt_cards(claim['passed'])}"])
    return _pick(gs, bot, [f"J'ai reçu {_fmt_cards(claim['received'])}, rien d'autre."],
                 [f"reçu {_fmt_cards(claim['received'])}, point"])


def _answer_vote(gs, bot) -> str:
    lv = gs.turn.last_vote
    if not lv:
        return _pick(gs, bot, ["On n'a pas encore voté."], ["y a pas encore eu de vote"])
    ballot = (lv.get("ballots") or {}).get(str(bot.seat))
    r, c = lv.get("regent_seat"), lv.get("nominee_seat")
    if ballot == "oui":
        return _pick(gs, bot, [f"J'ai voté oui : {_name(gs, c)} ne m'a rien fait de suspect jusque-là."],
                     [f"oui parce que {_name(gs, c)} me paraissait clean", "oui, fallait bien que ça avance"])
    reason = _reason_against(gs, c) or _reason_against(gs, r)
    if reason:
        return _pick(gs, bot, [f"J'ai voté non. {reason}"], [f"non. {reason[0].lower() + reason[1:]}"])
    return _pick(gs, bot, [f"Non, je ne sentais pas {_name(gs, c)} en Conseiller."],
                 [f"non, je sentais pas {_name(gs, c)}"])


def _answer_who(gs, bot) -> str:
    target = _suspect_for_talk(gs, bot)
    s = suspicion(gs, bot)
    if target is None or (_role(bot) != CONJURE and s.get(target, 0) < 0.6):
        return _pick(gs, bot, ["Trop tôt pour accuser qui que ce soit. Regardons les prochains votes.",
                               "Pas d'avis tranché pour l'instant."],
                     ["aucune idée pour l'instant", "trop tôt pour dire, on verra au prochain décret"])
    reason = _reason_against(gs, target)
    name = _name(gs, target)
    if reason:
        return _pick(gs, bot, [f"{name}. {reason}"], [f"{name}, clairement. {reason}"])
    return _pick(gs, bot, [f"Je surveille {name}.", f"{name} me met mal à l'aise."],
                 [f"{name} je le sens pas", f"perso je dirais {name}"])


def _defend_self(gs, bot, accuser_seat: Optional[int]) -> str:
    mem = memory(gs, bot)
    if accuser_seat is not None and _role(bot) != CONJURE and accuser_seat not in allies(gs, bot):
        # I know I'm innocent: whoever accuses me is wrong or framing me
        mem["grudges"][str(accuser_seat)] = mem["grudges"].get(str(accuser_seat), 0) + 0.6
    record = _my_good_record(gs, bot)
    openers_f = ["Moi ? Vous faites fausse route.", "Je suis Fidèle, et je le prouverai.",
                 "Accuser sans preuve, c'est ce que ferait un Traître."]
    openers_c = ["moi ?? n'importe quoi", "je suis fidèle, arrête", "t'as aucune preuve",
                 "pourquoi moi ? j'ai rien fait"]
    parts = [_pick(gs, bot, openers_f, openers_c)]
    if record:
        parts.append(record)
    if accuser_seat is not None and random.random() < persona(gs, bot)["aggr"] * 0.6:
        parts.append(_pick(gs, bot, [f"Et toi, {_name(gs, accuser_seat)}, pourquoi tant d'empressement ?"],
                           [f"et toi {_name(gs, accuser_seat)} tu détournes l'attention ?"]))
    else:
        # Only point at someone else with an actual reason (or, for a Traître, a plausible one)
        target = _suspect_for_talk(gs, bot, exclude=(accuser_seat,) if accuser_seat else ())
        reason = _reason_against(gs, target) if target is not None else None
        if reason:
            parts.append(reason)
        elif not _events(gs, "decree"):
            parts.append(_pick(gs, bot, ["On ne sait encore rien, attendons le premier décret."],
                               ["on sait rien encore, attends le premier décret"]))
    return _join(parts)


def _join(parts: List[str]) -> str:
    out = ""
    for part in parts:
        if not out:
            out = part
        elif out.rstrip()[-1:] in ".!?…":
            out += " " + part
        else:
            out += ". " + part[0].upper() + part[1:]
    return out


def _opinion_on(gs, bot, seat: int, accused: bool) -> Optional[str]:
    """React to a human accusing (or vouching for) another player."""
    name = _name(gs, seat)
    s = suspicion(gs, bot).get(seat, 0.0)
    if seat in allies(gs, bot):
        if accused and random.random() < 0.5:
            return _pick(gs, bot, [f"Je ne suis pas convaincu pour {name}.", f"{name} ? Rien de concret contre lui."],
                         [f"bof, {name} a rien fait de spécial", f"{name} ? je vois pas pourquoi"])
        return None
    if accused:
        if s >= 0.8:
            reason = _reason_against(gs, seat)
            return _pick(gs, bot, [f"D'accord pour {name}." + (f" {reason}" if reason else "")],
                         [f"+1 pour {name}" + (f". {reason}" if reason else ""), f"je suis d'accord, {name} est louche"])
        if s <= -0.3:
            reason = _reason_for(gs, seat)
            return _pick(gs, bot, [f"{name} ? Je ne crois pas." + (f" {reason}" if reason else "")],
                         [f"non pas {name}" + (f", {reason[0].lower() + reason[1:]}" if reason else "")])
        if random.random() < 0.4:
            return _pick(gs, bot, [f"Pourquoi {name} ? Expliquez-vous."], [f"pourquoi {name} ?", f"t'as quoi contre {name} ?"])
        return None
    if s >= 1.2:
        reason = _reason_against(gs, seat)
        return _pick(gs, bot, [f"Je n'en suis pas si sûr. {reason or ''}".strip()],
                     [f"mouais, {name} je suis pas sûr"])
    return None


def _catch_lie(gs, bot, speaker, n: str) -> Optional[str]:
    """A human claims cards that contradict what this bot saw in the same government."""
    if not TWO_BAD_RE.search(n):
        return None
    d = _last_gov_with(gs, speaker.seat)
    if not d or bot.seat not in (d.get("regent_seat"), d.get("chambellan_seat")):
        return None
    seen = memory(gs, bot)["seen"].get(str(d.get("turn")))
    if not seen or speaker.seat in allies(gs, bot):
        return None
    flag = f"lie-{d.get('turn')}-{speaker.seat}-{bot.seat}"
    tm = table(gs)
    if flag in tm["flags"]:
        return None
    if seen.get("role") == "chambellan" and LOYAL in seen.get("received", []):
        tm["flags"].append(flag)
        tm["accused"][str(speaker.seat)] = tm["accused"].get(str(speaker.seat), 0) + 2
        return _pick(gs, bot, [f"Faux ! Tu m'as transmis {_fmt_cards(seen['received'])}. J'ai joué le Loyal."
                               if seen.get("enacted") == LOYAL else
                               f"Faux, {speaker.name}. Tu m'as transmis {_fmt_cards(seen['received'])}."],
                         [f"menteur, tu m'as passé {_fmt_cards(seen['received'])}"])
    if seen.get("role") == "regent" and LOYAL in seen.get("passed", []):
        tm["flags"].append(flag)
        tm["accused"][str(speaker.seat)] = tm["accused"].get(str(speaker.seat), 0) + 2
        return _pick(gs, bot, [f"Mensonge ! Je t'ai transmis {_fmt_cards(seen['passed'])}, {speaker.name}."],
                     [f"c'est faux, je t'ai passé {_fmt_cards(seen['passed'])}"])
    return None


def on_human_chat(gs, speaker, text: str, now: float) -> None:
    """Schedule bot reactions to a message written by a human."""
    if speaker.is_bot or gs.status != "in_progress":
        return
    bots_alive = [p for p in gs.players if p.is_bot and p.alive]
    if not bots_alive:
        return
    n = _norm(text)
    mentioned = [s for s in mentioned_seats(gs, text) if s != speaker.seat]
    question = "?" in text or bool(re.match(r"^(qui|pourquoi|quoi|comment|t'?as|tu as|est-ce|vous)", n))
    # "qui est le traître ?" asks for an opinion, it doesn't accuse anybody
    asking_who = question and bool(WHO_RE.search(n))
    accusing = bool(ACCUSE_RE.search(n)) and not asking_who
    defending = bool(DEFEND_RE.search(n)) and not accusing and not asking_who
    tm = table(gs)

    # public record of accusations (influences everyone's suspicion a bit)
    if accusing:
        for s in mentioned:
            tm["accused"][str(s)] = tm["accused"].get(str(s), 0) + 1

    replies: List[Tuple[Any, str]] = []

    # 1. a bot that shared the government catches a lie about the cards
    for b in bots_alive:
        line = _catch_lie(gs, b, speaker, n)
        if line:
            replies.append((b, line))

    # 2. bots addressed by name
    for b in [x for x in bots_alive if x.seat in mentioned]:
        if any(r[0] is b for r in replies):
            continue
        if asking_who:
            line = _answer_who(gs, b)
        elif ROLE_RE.search(n) and question:
            line = _pick(gs, b, ["Fidèle, évidemment.", "Fidèle à la Couronne. Comme tout le monde ici, paraît-il."],
                         ["fidèle bien sûr", "fidèle, et toi ?"])
        elif accusing:
            line = _defend_self(gs, b, speaker.seat)
        elif CARDS_RE.search(n):
            line = _answer_cards(gs, b)
        elif VOTE_RE.search(n):
            line = _answer_vote(gs, b)
        elif ROLE_RE.search(n):
            line = _pick(gs, b, ["Fidèle, évidemment.", "Fidèle à la Couronne. Comme tout le monde ici, paraît-il."],
                         ["fidèle bien sûr", "fidèle, et toi ?"])
        elif WHO_RE.search(n):
            line = _answer_who(gs, b)
        elif defending:
            line = _pick(gs, b, ["Merci de ta confiance.", "Enfin quelqu'un de lucide."], ["merci", "enfin quelqu'un qui réfléchit"])
        elif question:
            line = _pick(gs, b, ["Bonne question… je réfléchis.", "Je n'ai rien à cacher, demandez."],
                         ["hmm bonne question", "demande ce que tu veux"])
        else:
            line = _pick(gs, b, ["Oui ?", "Je t'écoute."], ["oui ?", "quoi ?", "hmm ?"])
        replies.append((b, line))

    # 3. nobody addressed: one or two bots may join in
    if not replies:
        others = [s for s in mentioned if s not in {b.seat for b in bots_alive}]
        pool = sorted(bots_alive, key=lambda b: -persona(gs, b)["talk"] * random.random())
        for b in pool:
            if len(replies) >= (2 if accusing and others else 1):
                break
            line = None
            if GREET_RE.search(n) and random.random() < 0.6:
                line = _pick(gs, b, ["Bien le bonjour.", "Salutations."], ["salut", "yo", "bonsoir"])
            elif others and (accusing or defending):
                if random.random() < persona(gs, b)["talk"]:
                    line = _opinion_on(gs, b, others[0], accused=accusing)
            elif question and CARDS_RE.search(n):
                d = gs.turn.last_decree
                if d and b.seat in (d.get("regent_seat"), d.get("chambellan_seat")):
                    line = _answer_cards(gs, b)
            elif asking_who and random.random() < persona(gs, b)["talk"]:
                line = _answer_who(gs, b)
            elif question and VOTE_RE.search(n) and random.random() < 0.5:
                line = _answer_vote(gs, b)
            if line:
                replies.append((b, line))

    for i, (b, line) in enumerate(replies[:3]):
        queue_line(gs, b, line, now, delay=random.uniform(1.8, 3.5) + i * random.uniform(2.0, 4.0)
                   + min(len(line) * 0.035, 3.5))


# ----------------------------------------------------------------------
# unprompted remarks (driven by the ticker)
# ----------------------------------------------------------------------
def accusation(gs, player) -> Optional[str]:
    """Occasional remark during the Conseil, backed by a public fact when possible."""
    if random.random() > persona(gs, player)["talk"]:
        return None
    d = gs.turn.last_decree
    if d and d.get("type") == LOYAL and random.random() < 0.35:
        return _pick(gs, player, ["Un Loyal. Ce gouvernement mérite qu'on le garde à l'œil… en bien.",
                                  "Enfin une bonne nouvelle pour la Couronne."],
                     ["enfin un loyal", "bien joué pour le loyal", "ok ça c'est propre"])
    target = _suspect_for_talk(gs, player)
    s = suspicion(gs, player)
    if target is not None and (_role(player) == CONJURE or s.get(target, 0) >= 0.8) \
            and random.random() < 0.4 + persona(gs, player)["aggr"] * 0.5:
        name = _name(gs, target)
        reason = _reason_against(gs, target)
        if reason and random.random() < 0.75:
            return reason
        return _pick(gs, player, [f"Je me méfie de {name}.", f"Si j'étais Roi, je ne nommerais pas {name}.",
                                  f"Gardez un œil sur {name}."],
                     [f"{name} je le sens pas du tout", f"moi je nommerais pas {name}", f"attention à {name}"])
    calm_f = ["Rien de concluant pour l'instant. Observons les votes."]
    calm_c = ["bon, on avance", "rien de clair pour l'instant"]
    # Ask for cards only if a human sat in the government (bots always announce theirs)
    gov = [_by_seat(gs, s) for s in ((d or {}).get("regent_seat"), (d or {}).get("chambellan_seat"))]
    quiet = [p for p in gov if p and not p.is_bot and p.alive]
    if quiet:
        names = " et ".join(p.name for p in quiet)
        calm_f.append(f"{names}, vos cartes ? Un Fidèle n'a rien à cacher.")
        calm_c.append(f"{names} t'avais quoi comme cartes ?")
    if random.random() < 0.5:
        return _pick(gs, player, calm_f, calm_c)
    return None


def react_to_nomination(gs, now: float) -> None:
    """One bot may comment on the King's choice while the vote is open."""
    t = gs.turn
    flag = f"nom-{t.turn_number}-{t.regent_seat}-{t.nominee_seat}-{gs.tracks.crisis}"
    tm = table(gs)
    if flag in tm["flags"]:
        return
    tm["flags"].append(flag)
    tm["flags"] = tm["flags"][-200:]
    voters = [p for p in gs.players if p.is_bot and p.alive and p.seat not in (t.regent_seat, t.nominee_seat)]
    if not voters or random.random() > 0.45:
        return
    b = max(voters, key=lambda x: persona(gs, x)["talk"] * random.random())
    c = t.nominee_seat
    name = _name(gs, c)
    if gs.tracks.conjure >= 3 and _role(b) != CONJURE:
        line = _pick(gs, b, [f"Attention : si {name} est le Tyran, la partie est finie."],
                     [f"3 trahisons… si {name} est tyran on a perdu, réfléchissez"])
    elif c in allies(gs, b):
        line = _pick(gs, b, [f"{name} me semble un choix raisonnable."], ["ça me va", f"ok pour {name}"])
    else:
        s = suspicion(gs, b).get(c, 0.0)
        if s >= 1.0 or (_role(b) == CONJURE and random.random() < 0.3):
            reason = _reason_against(gs, c)
            line = _pick(gs, b, [f"{name} Conseiller ? Sans moi." + (f" {reason}" if reason else "")],
                         [f"{name} conseiller ? non merci", f"sérieux, {name} ?"])
        elif gs.tracks.crisis >= 2:
            line = _pick(gs, b, ["La Crise est à 2 : votez oui, sauf certitude."],
                         ["crise à 2, faut voter oui là"])
        else:
            line = _pick(gs, b, ["Ça me va.", f"{name}, pourquoi pas."], ["ok", "ça me va", f"go pour {name}"])
    queue_line(gs, b, line, now)


def react_to_vote(gs, now: float) -> None:
    """After the ballots are revealed, a bot may comment on a surprising vote."""
    lv = gs.turn.last_vote
    if not lv:
        return
    flag = f"vote-{lv.get('ts')}"
    tm = table(gs)
    if flag in tm["flags"]:
        return
    tm["flags"].append(flag)
    if random.random() > 0.35:
        return
    bots_alive = [p for p in gs.players if p.is_bot and p.alive]
    if not bots_alive:
        return
    b = random.choice(bots_alive)
    if lv.get("result") == "rejected":
        if gs.tracks.crisis >= 2:
            line = _pick(gs, b, ["La Crise est à 2. Au prochain échec, le peuple choisit à notre place."],
                         ["crise à 2, on peut plus se rater"])
        else:
            line = _pick(gs, b, ["Rejeté. Suivant."], ["rejeté, au suivant", "bon, raté"])
    else:
        noes = [int(s) for s, v in (lv.get("ballots") or {}).items() if v == "non" and int(s) != b.seat]
        if noes and random.random() < 0.6:
            seat = random.choice(noes)
            line = _pick(gs, b, [f"Pourquoi as-tu voté non, {_name(gs, seat)} ?"],
                         [f"{_name(gs, seat)} pourquoi non ?"])
        else:
            return
    queue_line(gs, b, line, now)

"""
Dark Oath — bots.

Bots are ordinary players flagged ``is_bot``. The server's ticker asks
``decide()`` what a bot (or an absent human, see AFK takeover) should do in
the current phase, and applies it through the same code path as a human
action, so bots can never break the rules.

The AI is heuristic and role-aware:
  * Fidèles (and the Tyran, who knows nobody) build a suspicion score from
    public facts only: who sat in governments that enacted Trahison decrees,
    contradictions with their own cards, votes, defiance marks, and private
    investigation results.
  * Traîtres know their allies: they push the Tyran into power after
    3 Trahisons, protect allies, sabotage decrees while trying not to be
    too obvious, and frame Fidèles.

The module works on the server's pydantic GameState but only reads it,
except for ``memory`` (gs.bot_memory[player_id]) which stores private
knowledge (cards seen, investigation results, claims already made).
"""
from __future__ import annotations

import random
from typing import Any, Dict, List, Optional, Tuple

BOT_NAMES = [
    "Sire Aldric", "Dame Isolde", "Frère Anselme", "Baron Godfroy",
    "Dame Mahaut", "Sire Tristan", "Comtesse Aliénor", "Messire Perceval",
    "Dame Ysaline", "Sire Gauvain", "Abbesse Hildegarde", "Chevalier Bertrand",
]

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
        mem = {"investigations": {}, "claims_done": [], "seen": {}}
        gs.bot_memory[player.id] = mem
    return mem


def _alive(gs) -> List[Any]:
    return [p for p in gs.players if p.alive]


def _by_seat(gs, seat):
    return next((p for p in gs.players if p.seat == seat), None)


def allies(gs, player) -> set:
    """Seats this player *knows* to be on the evil side (Traîtres only)."""
    if _role(player) != CONJURE:
        return set()
    return {p.seat for p in gs.players if _role(p) in (CONJURE, USURPATEUR) and p.seat != player.seat}


def tyran_seat(gs) -> Optional[int]:
    t = next((p for p in gs.players if _role(p) == USURPATEUR), None)
    return t.seat if t else None


def _events(gs, kind: str) -> List[Dict[str, Any]]:
    return [e for e in gs.events if e.get("kind") == kind]


# ----------------------------------------------------------------------
# suspicion model (Fidèle / Tyran point of view)
# ----------------------------------------------------------------------
def suspicion(gs, player) -> Dict[int, float]:
    """Higher = more likely a Traître, from this player's point of view."""
    mem = memory(gs, player)
    scores: Dict[int, float] = {p.seat: 0.0 for p in gs.players if p.seat != player.seat}

    for e in _events(gs, "decree"):
        if e.get("auto"):
            continue
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
        # As Conseiller: I received 2 Trahisons although the King drew a Loyal?
        # (unknowable) — but if I received only Trahisons, the King is suspect.
        if seen and seen.get("role") == "chambellan" and r in scores:
            if seen.get("received") == [CONJURE, CONJURE]:
                scores[r] += 1.5

    # Voting for governments that enacted Trahison
    decrees_by_turn = {e.get("turn"): e for e in _events(gs, "decree") if not e.get("auto")}
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

    # Public defiance pressure
    for seat, count in (gs.turn.defiance_counts or {}).items():
        if int(seat) in scores:
            scores[int(seat)] += 0.15 * count

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

    Traîtres always do. The Tyran knows nobody, so it plays like a Fidèle to
    stay hidden, and only sabotages when the Fidèles are about to win.
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

    if phase == "LEGIS_CHAMBELLAN" and t.nominee_seat == player.seat and t.legislative_cards:
        return ("DISCARD", {"cardId": _chambellan_pick(gs, player)})

    if phase == "POWER" and t.regent_seat == player.seat:
        if t.active_power == "INVESTIGATE":
            if t.power_result is None:
                return ("INVESTIGATE", {"targetSeat": _investigate_target(gs, player)})
            return ("ACK_POWER", {})
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
    if _role(player) == CONJURE:
        ty = tyran_seat(gs)
        if gs.tracks.conjure >= 3 and c == ty:
            return "oui"
        friends = allies(gs, player)
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


def _targets(gs, player) -> List[int]:
    return [p.seat for p in _alive(gs) if p.seat != player.seat]


def _investigate_target(gs, player) -> Optional[int]:
    mem = memory(gs, player)
    seats = [s for s in _targets(gs, player) if str(s) not in mem["investigations"]] or _targets(gs, player)
    if _role(player) == CONJURE:
        foes = [s for s in seats if s not in allies(gs, player)]
        return random.choice(foes or seats)
    return _most_suspect(gs, player, seats)


def _execute_target(gs, player) -> Optional[int]:
    seats = _targets(gs, player)
    if _role(player) == CONJURE:
        foes = [s for s in seats if s not in allies(gs, player)]
        # Kill the Fidèle who is the most trusted (most dangerous for us)
        return _least_suspect(gs, player, foes or seats)
    if _role(player) == USURPATEUR:
        return _most_suspect(gs, player, seats)
    return _most_suspect(gs, player, seats)


def _defiance_target(gs, player) -> Optional[int]:
    seats = _targets(gs, player)
    if not seats:
        return None
    if _role(player) == CONJURE:
        foes = [s for s in seats if s not in allies(gs, player)]
        if foes and random.random() < 0.6:
            return _most_suspect(gs, player, foes)  # frame the Fidèle the table already doubts
        return None
    s = suspicion(gs, player)
    target = max(seats, key=lambda x: s.get(x, 0.0))
    return target if s.get(target, 0.0) >= 1.2 else None


# ----------------------------------------------------------------------
# table talk
# ----------------------------------------------------------------------
def _fmt_cards(cards: List[str]) -> str:
    n_l = cards.count(LOYAL)
    n_c = cards.count(CONJURE)
    parts = []
    if n_l:
        parts.append(f"{n_l} Loyal" + ("aux" if n_l > 1 else ""))
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
            # Lie: pretend we had no choice
            if random.random() < 0.6:
                return f"J'ai pioché {_fmt_cards([CONJURE] * 3)}. Je n'avais aucun choix."
            return f"J'ai pioché {_fmt_cards([LOYAL, CONJURE, CONJURE])} et j'ai transmis un Loyal… mon Conseiller a choisi la Trahison."
        return f"J'ai pioché {_fmt_cards(drawn)} et j'ai transmis {_fmt_cards(passed)}."

    received = seen.get("received", [])
    if evil and enacted == CONJURE:
        return f"On ne m'a donné que {_fmt_cards([CONJURE, CONJURE])}. Demandez au Roi pourquoi."
    if enacted == CONJURE and received == [CONJURE, CONJURE]:
        return "Je n'ai reçu que deux Trahisons. Le Roi doit s'expliquer."
    return f"J'ai reçu {_fmt_cards(received)}."


def investigation_claim(gs, player, target_seat: int, camp: str) -> str:
    name = _by_seat(gs, target_seat).name if _by_seat(gs, target_seat) else f"siège {target_seat}"
    if _role(player) == CONJURE:
        # Lie to protect allies / frame Fidèles
        if target_seat in allies(gs, player):
            camp = "Fidèle"
        elif random.random() < 0.7:
            camp = "Traître"
    return f"J'ai sondé l'âme de {name} : {camp}."


def _reason_against(gs, seat: int) -> Optional[str]:
    """A public fact that makes `seat` look bad, phrased as table talk."""
    name = _by_seat(gs, seat).name
    bad_govs = [e for e in _events(gs, "decree")
                if not e.get("auto") and e.get("type") == CONJURE
                and seat in (e.get("regent_seat"), e.get("chambellan_seat"))]
    if len(bad_govs) >= 2:
        return f"{name} était au gouvernement pour {len(bad_govs)} Trahisons. Ça fait beaucoup."
    if bad_govs:
        role = "Conseiller" if bad_govs[-1].get("chambellan_seat") == seat else "Roi"
        return f"{name} était {role} quand la Trahison est passée. Je ne l'oublie pas."
    count = (gs.turn.defiance_counts or {}).get(seat, 0)
    if count >= 2:
        return f"{name} accumule les soupçons de la table, et pas pour rien."
    yes_bad = 0
    decrees_by_turn = {e.get("turn"): e for e in _events(gs, "decree") if not e.get("auto")}
    for v in _events(gs, "vote"):
        d = decrees_by_turn.get(v.get("turn"))
        if v.get("result") == "elected" and d and d.get("type") == CONJURE and (v.get("ballots") or {}).get(str(seat)) == "oui":
            yes_bad += 1
    if yes_bad:
        return f"{name} a voté pour le gouvernement qui a fait passer la Trahison."
    return None


def accusation(gs, player) -> Optional[str]:
    """Occasional remark during the Conseil, backed by a public fact when possible."""
    if random.random() < 0.4:
        return None
    seats = _targets(gs, player)
    if not seats:
        return None
    s = suspicion(gs, player)
    if _role(player) == CONJURE:
        pool = [x for x in seats if x not in allies(gs, player)]
    else:
        pool = seats
    if not pool:
        return None
    # pick among the top-2 suspects so bots don't all gang up on the same name
    ranked = sorted(pool, key=lambda x: -s.get(x, 0.0))[:2]
    already = {m.get("message") for m in gs.turn.chat_messages[-8:]}
    for target in random.sample(ranked, len(ranked)):
        if _role(player) != CONJURE and s.get(target, 0) < 0.8:
            continue
        reason = _reason_against(gs, target)
        name = _by_seat(gs, target).name
        options = [reason] if reason else []
        options += [f"Je me méfie de {name}.", f"Si j'étais Roi, je ne nommerais pas {name}.",
                    f"Gardez un œil sur {name}."]
        options = [o for o in options if o and o not in already]
        if options:
            return options[0] if reason and options[0] == reason and random.random() < 0.7 else random.choice(options)
    calm = [
        "Rien de concluant pour l'instant. Observons les votes.",
        "Je fais confiance au prochain Roi… pour l'instant.",
        "Que chacun annonce ses cartes, et vite.",
        "Un Fidèle n'a rien à cacher. Parlez.",
    ]
    calm = [c for c in calm if c not in already]
    return random.choice(calm) if calm else None

"""
Full-game simulation: rooms filled with bots (plus one absent human host,
taken over by the AFK logic) play complete games through the real engine.

Run:  python -m pytest tests/test_simulation.py -q
  or  python tests/test_simulation.py 500     (prints win statistics)
"""
import asyncio
import os
import random
import sys
from collections import Counter
from pathlib import Path

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "darkoath_test")
os.environ.setdefault("APP_SECRET", "x" * 48)
os.environ.setdefault("ADMIN_USERNAME", "admin")
os.environ.setdefault("ADMIN_PASSWORD", "admin")
os.environ.setdefault("ADMIN_SECRET", "y" * 48)
os.environ.setdefault("CORS_ORIGINS", "http://localhost:3000")
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

import server  # noqa: E402

TOTAL_CARDS = 17


class FakeClock:
    def __init__(self):
        self.t = 1_000_000.0

    def __call__(self):
        return self.t


def _check_invariants(gs):
    t = gs.turn
    enacted_by_vote = sum(1 for e in gs.events if e["kind"] == "decree")
    in_play = len(gs.deck) + len(gs.discard) + len(t.legislative_cards) + enacted_by_vote
    assert in_play == TOTAL_CARDS, f"cards leaked: {in_play}"
    assert gs.tracks.loyal + gs.tracks.conjure == enacted_by_vote
    assert sum(1 for p in gs.players if p.role == server.Role.USURPATEUR) == 1


async def play_one(n_players: int, seed: int):
    random.seed(seed)
    clock = FakeClock()
    server._now = clock  # every engine timestamp goes through _now()
    mgr = server.manager
    code = f"SIM{seed}"
    gs = mgr.create_room(code)
    ok, _ = mgr.add_player(code, "human-host", "Hôte absent")
    assert ok and gs.host_id == "human-host"
    for _ in range(n_players - 1):
        assert mgr.add_bot(gs)
    assert mgr.start_game(code)
    phases = Counter()
    for _ in range(20_000):
        clock.t += 1.5
        await server.tick_room(code, gs)
        phases[gs.turn.phase.value] += 1
        _check_invariants(gs)
        if gs.turn.phase == server.Phase.ENDGAME:
            break
    else:
        raise AssertionError(f"game stuck in {gs.turn.phase} (seed={seed}, n={n_players})")
    mgr.game_states.pop(code, None)
    return gs.winner, gs.winner_reason, gs.turn.turn_number, gs


def run(games: int):
    stats = Counter()
    reasons = Counter()
    turns = []
    afk = 0
    chat = 0
    for i in range(games):
        n = 5 + i % 6
        winner, reason, turn, gs = asyncio.run(play_one(n, i))
        stats[winner] += 1
        reasons[reason] += 1
        turns.append(turn)
        afk += sum(1 for e in gs.events if e["kind"] == "afk")
        chat += sum(1 for m in gs.turn.chat_messages if m.get("is_bot"))
    return stats, reasons, turns, afk, chat


def test_bot_games_always_finish():
    stats, reasons, turns, afk, chat = run(120)
    assert sum(stats.values()) == 120
    assert set(stats) <= {"FIDELES", "CONJURES"}
    # both camps must be able to win, and the Tyran-elected rule must fire
    assert stats["FIDELES"] > 0 and stats["CONJURES"] > 0
    assert reasons["tyran_elected"] > 0
    assert afk > 0, "the absent human host should have been replaced"
    assert chat > 0, "bots should talk"


def test_all_players_vote_and_votes_are_secret():
    random.seed(1)
    clock = FakeClock()
    server._now = clock
    mgr = server.manager
    gs = mgr.create_room("VOTE1")
    for i in range(5):
        mgr.add_player("VOTE1", f"h{i}", f"Joueur{i}")
    assert mgr.start_game("VOTE1")
    king = next(p for p in gs.players if p.seat == gs.turn.regent_seat)
    seat = server.eligible_nominee_seats(gs)[0]

    async def go():
        await server.perform_action("VOTE1", gs, king, "NOMINATE", {"nomineeSeat": seat})
        gov = (king.seat, seat)
        for p in (q for q in gs.players if q.seat in gov):
            try:
                await server.perform_action("VOTE1", gs, p, "VOTE", {"vote": "oui"})
                raise AssertionError("the government must not vote")
            except server.HTTPException:
                pass
        table = [p for p in gs.players if p.seat not in gov]
        assert set(server.manager.pending_actor_ids(gs)) == {p.id for p in table}
        for p in table[:-1]:
            await server.perform_action("VOTE1", gs, p, "VOTE", {"vote": "oui"})
        assert gs.turn.phase == server.Phase.VOTE  # still waiting for the last voter
        await server.perform_action("VOTE1", gs, table[-1], "VOTE", {"vote": "non"})
    asyncio.run(go())
    assert gs.turn.last_vote["yes"] == 2 and gs.turn.last_vote["no"] == 1
    assert set(gs.turn.last_vote["ballots"]) == {str(p.seat) for p in gs.players if p.seat not in (king.seat, seat)}
    assert gs.turn.phase == server.Phase.LEGIS_REGENT


def test_term_limit_survives_full_turn():
    random.seed(3)
    clock = FakeClock()
    server._now = clock
    mgr = server.manager
    gs = mgr.create_room("TERM1")
    for i in range(7):
        mgr.add_player("TERM1", f"h{i}", f"Joueur{i}")
    assert mgr.start_game("TERM1")
    by = {p.seat: p for p in gs.players}

    async def one_turn():
        king = by[gs.turn.regent_seat]
        nominee = server.eligible_nominee_seats(gs)[0]
        await server.perform_action("TERM1", gs, king, "NOMINATE", {"nomineeSeat": nominee})
        for p in gs.players:
            if p.seat not in (king.seat, nominee):
                await server.perform_action("TERM1", gs, p, "VOTE", {"vote": "oui"})
        await server.perform_action("TERM1", gs, king, "DISCARD", {"cardId": 0})
        await server.perform_action("TERM1", gs, by[nominee], "DISCARD", {"cardId": 0})
        for p in gs.players:
            await server.perform_action("TERM1", gs, p, "CONSEIL_READY", {})
        return king.seat, nominee
    king_seat, nominee = asyncio.run(one_turn())
    if gs.turn.phase == server.Phase.NOMINATION:
        assert nominee not in server.eligible_nominee_seats(gs)
        assert gs.turn.prev_government == {"regent": king_seat, "chambellan": nominee}


def _room(code, n_humans, n_bots=0, seed=7):
    random.seed(seed)
    clock = FakeClock()
    server._now = clock
    mgr = server.manager
    gs = mgr.create_room(code)
    for i in range(n_humans):
        mgr.add_player(code, f"{code}-h{i}", f"Joueur{i}")
    for _ in range(n_bots):
        mgr.add_bot(gs)
    assert mgr.start_game(code)
    return gs, clock


def test_special_election_then_rotation_resumes():
    gs, _ = _room("SPEC1", 7)
    t = gs.turn
    t.regent_seat = 2
    t.phase = server.Phase.POWER
    t.active_power = "SPECIAL_ELECTION"
    king = next(p for p in gs.players if p.seat == 2)
    asyncio.run(server.perform_action("SPEC1", gs, king, "SPECIAL_ELECTION", {"targetSeat": 6}))
    assert t.phase == server.Phase.NOMINATION and t.regent_seat == 6
    server.manager._advance_to_next_nomination(gs)
    assert t.regent_seat == 3  # back to the player after the King who called it


def test_veto_accepted_discards_and_advances_crisis():
    gs, _ = _room("VETO1", 5)
    t = gs.turn
    gs.tracks.conjure = 5
    by = {p.seat: p for p in gs.players}
    t.regent_seat, t.nominee_seat = 1, 2
    t.phase = server.Phase.LEGIS_CHAMBELLAN
    t.legislative_cards = [server.DecreeType.CONJURE, server.DecreeType.CONJURE]
    gs.deck = gs.deck[:13]  # 17 - 2 cards in hand - 2 already enacted elsewhere doesn't matter here

    async def go():
        await server.perform_action("VETO1", gs, by[2], "VETO", {})
        assert server.manager.pending_actor_ids(gs) == [by[1].id]
        await server.perform_action("VETO1", gs, by[1], "VETO_RESPONSE", {"accept": True})
    asyncio.run(go())
    assert gs.tracks.crisis == 1 and gs.tracks.conjure == 5
    assert t.phase == server.Phase.NOMINATION and not t.legislative_cards


def test_term_limits_secret_hitler():
    gs, _ = _room("TL1", 6)
    t = gs.turn
    t.regent_seat = 3
    t.prev_government = {"regent": 1, "chambellan": 2}
    assert set(server.eligible_nominee_seats(gs)) == {4, 5, 6}
    gs.players[5].alive = False  # 5 alive: the last King becomes eligible again
    assert set(server.eligible_nominee_seats(gs)) == {1, 4, 5}


def test_bot_answers_when_accused_by_name():
    gs, clock = _room("CHAT1", 1, 4)
    human = gs.players[0]
    bot = next(p for p in gs.players if p.is_bot)
    first = bot.name.split()[-1]
    server.bots.on_human_chat(gs, human, f"{first} t'es un traître non ?", clock())
    assert any(q["player_id"] == bot.id for q in gs.bot_chat_queue)
    clock.t += 30
    posted = []
    server.bots.flush_chat(gs, clock(), lambda p, text: posted.append((p.id, text)))
    assert any(pid == bot.id for pid, _ in posted)


def test_who_question_is_not_an_accusation():
    gs, clock = _room("CHAT2", 1, 4)
    human = gs.players[0]
    bot = next(p for p in gs.players if p.is_bot)
    first = bot.name.split()[-1]
    server.bots.on_human_chat(gs, human, f"{first} tu penses que c'est qui le traître ?", clock())
    lines = [q["text"].lower() for q in gs.bot_chat_queue if q["player_id"] == bot.id]
    assert lines, "the bot should answer"
    assert not any(w in lines[0] for w in ("moi ?", "preuve", "pourquoi moi", "fausse route")), lines[0]
    assert not server.bots.table(gs)["accused"].get(str(bot.seat))


def test_bot_explains_its_vote_and_never_says_just_oui():
    gs, clock = _room("CHAT3", 1, 6)
    t = gs.turn
    human = gs.players[0]
    t.regent_seat, t.nominee_seat = 2, 3
    t.phase = server.Phase.VOTE
    bot = next(p for p in gs.players if p.is_bot and p.seat not in (2, 3))
    first = bot.name.split()[-1]
    for msg in (f"{first} tu votes quoi ?", f"{first} t'en dis quoi", f"{first} ça va ?"):
        gs.bot_chat_queue = []
        server.bots.on_human_chat(gs, human, msg, clock())
        line = next(q["text"] for q in gs.bot_chat_queue if q["player_id"] == bot.id)
        assert line.strip().lower() not in ("oui ?", "oui", "quoi ?", "hmm ?"), (msg, line)
        if "vote" in msg:
            assert ("oui" in line.lower() or "non" in line.lower()), line
            assert ("non" in line.lower()) == (server.bots._vote(gs, bot) == "non"), line


if __name__ == "__main__":
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 300
    stats, reasons, turns, afk, chat = run(n)
    print("winners:", dict(stats))
    print("reasons:", dict(reasons))
    print(f"turns: avg {sum(turns)/len(turns):.1f}, max {max(turns)}")
    print("afk takeovers:", afk, " bot chat lines:", chat)

from fastapi import FastAPI, APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import json
import asyncio
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any
import uuid
from datetime import datetime, timezone
from enum import Enum
import random
import time
from fastapi import Header
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import admin_stats
import bots
from auth import (
    PlayerIdentity,
    issue_player_token,
    decode_player_token,
    require_player,
)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# === Rate limiting ===
# Single shared limiter, keyed on the client IP. Per-route limits are declared
# via decorators below. The handler converts RateLimitExceeded into a clean
# 429 JSON response.
limiter = Limiter(key_func=get_remote_address, default_limits=[])

# === Content bounds ===
MAX_PLAYER_NAME_LEN = 24
MAX_CHAT_MESSAGE_LEN = 500
# Prune rooms that have been idle for longer than this. Keeps the in-memory
# state from growing without bound when players abandon rooms.
ROOM_IDLE_TTL_SECONDS = 60 * 60 * 3  # 3h

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# Game Models
class Role(str, Enum):
    LOYAL = "LOYAL"
    CONJURE = "CONJURE"
    USURPATEUR = "USURPATEUR"

class Phase(str, Enum):
    LOBBY = "LOBBY"
    DEAL_ROLES = "DEAL_ROLES"
    NOMINATION = "NOMINATION"
    VOTE = "VOTE"
    LEGIS_REGENT = "LEGIS_REGENT"
    LEGIS_CHAMBELLAN = "LEGIS_CHAMBELLAN"
    CONSEIL_ROYAUME = "CONSEIL_ROYAUME"
    DEFIANCE = "DEFIANCE"
    POWER = "POWER"
    ENDGAME = "ENDGAME"

# Piste de Défiance config
DEFIANCE_DURATION_SECONDS = 25
DEFIANCE_MARK_THRESHOLD = 3
# Conseil du Royaume (can end earlier when every present human clicks "Prêt")
CONSEIL_DURATION_SECONDS = int(os.environ.get("DARKOATH_CONSEIL_SECONDS", "60"))
# Presence / AFK takeover: a human not seen for AWAY_AFTER_SECONDS is "absent";
# a bot plays for an absent human after AWAY_GRACE_SECONDS, and for anyone
# who has not acted after AFK_ACTION_TIMEOUT_SECONDS.
AWAY_AFTER_SECONDS = 20
AWAY_GRACE_SECONDS = 5
AFK_ACTION_TIMEOUT_SECONDS = int(os.environ.get("DARKOATH_AFK_SECONDS", "45"))  # overridable for local testing
# Bots "think" for a random delay before acting (seconds)
BOT_THINK_SECONDS = (1.5, 4.0)

class DecreeType(str, Enum):
    LOYAL = "LOYAL"
    CONJURE = "CONJURE"

class Player(BaseModel):
    id: str
    name: str
    seat: int
    role: Optional[Role] = None
    alive: bool = True
    connected: bool = True
    is_bot: bool = False

class GameTracks(BaseModel):
    loyal: int = 0
    conjure: int = 0
    crisis: int = 0

class TurnState(BaseModel):
    regent_seat: int = 1
    nominee_seat: Optional[int] = None
    prev_government: Optional[Dict[str, int]] = None
    phase: Phase = Phase.LOBBY
    votes: Dict[str, str] = {}
    deck_count: int = 17
    discard_count: int = 0
    legislative_cards: List[DecreeType] = []  # Cards currently being considered by regent/chambellan
    chat_messages: List[Dict] = []  # Store chat messages for the room
    disgraced_player_seat: Optional[int] = None  # Player who was disgraced due to "Colère du Peuple"
    peoples_anger_triggered: bool = False  # Flag to show "Colère du Peuple" message
    conseil_royaume_timer: Optional[int] = None  # Timer for Conseil du Royaume phase (30 seconds)
    conseil_royaume_start_time: Optional[float] = None  # Start time for the council phase
    speaking_players: List[int] = []  # List of players currently speaking
    # Piste de Défiance
    turn_number: int = 0  # Increments each new NOMINATION after a completed round
    defiance_counts: Dict[int, int] = {}  # seat -> cumulative defiance votes received
    defiance_votes: Dict[str, Optional[int]] = {}  # voter_id -> target seat or None (passed)
    marked_player_seat: Optional[int] = None  # Player marked for current turn (cannot be Roi/Conseiller)
    defiance_start_time: Optional[float] = None
    # Pouvoir du Roi (POWER phase)
    active_power: Optional[str] = None  # "INVESTIGATE" | "EXECUTE" while in POWER phase
    power_result: Optional[Dict] = None  # Investigation result, visible to King only: {target_seat, target_name, camp}
    last_execution_seat: Optional[int] = None  # Seat just executed (for death banner broadcast)
    # Conseil du Royaume — players who clicked "Prêt" (early end when every present human is ready)
    conseil_ready: List[str] = []
    # Public reveals
    last_vote: Optional[Dict[str, Any]] = None    # {turn, regent_seat, nominee_seat, result, yes, no, ballots: {seat: "oui"|"non"}}
    last_decree: Optional[Dict[str, Any]] = None  # {turn, type, regent_seat, chambellan_seat, auto}
    # Server clock for the current phase (used for AFK timeouts + client countdowns)
    phase_started_at: Optional[float] = None

class GameState(BaseModel):
    room_code: str
    status: str = "lobby"
    players: List[Player] = []
    tracks: GameTracks = GameTracks()
    turn: TurnState = TurnState()
    powers: Dict[str, bool] = {
        "investigation_unlocked": False,
        "investigation_used": False,
        "execution_unlocked": False,
        "execution_used": False,
        "executed_once": False,  # legacy flag, kept for compatibility
    }
    winner: Optional[str] = None
    winner_reason: Optional[str] = None  # Human-readable cause ("tyran_executed", "5_loyal", "6_conjure", ...)
    version: int = 0
    deck: List[DecreeType] = []
    discard: List[DecreeType] = []
    # Room creator; may add/remove bots, kick, start and restart.
    host_id: Optional[str] = None
    # Public game log ("Chronique du Royaume")
    events: List[Dict[str, Any]] = []
    # Server-side bookkeeping (never sent to clients)
    last_seen: Dict[str, float] = {}          # player_id -> last request timestamp
    bot_memory: Dict[str, Dict[str, Any]] = {}  # player_id -> private bot memory
    bot_next_act: Dict[str, float] = {}       # player_id -> when the bot may act in this phase
    phase_key: Optional[str] = None           # detects phase changes for the phase clock


def _now() -> float:
    """Single clock for the game engine (monkeypatched by the simulation tests)."""
    return time.time()


MAX_EVENTS = 300


def log_event(game_state: "GameState", kind: str, text: str, **data: Any) -> None:
    """Append a public entry to the Chronique du Royaume."""
    game_state.events.append({
        "id": (game_state.events[-1]["id"] + 1) if game_state.events else 1,
        "turn": game_state.turn.turn_number,
        "kind": kind,
        "text": text,
        "ts": _now(),
        **data,
    })
    if len(game_state.events) > MAX_EVENTS:
        game_state.events = game_state.events[-MAX_EVENTS:]


def seat_name(game_state: "GameState", seat: Optional[int]) -> str:
    p = next((p for p in game_state.players if p.seat == seat), None)
    return p.name if p else f"Siège {seat}"


def eligible_nominee_seats(game_state: "GameState") -> List[int]:
    """Seats the current King may nominate as Conseiller.

    Constraints: alive, not the King, not in the last elected government,
    not disgraced (Colère du Peuple), not marked (Piste de Défiance).
    If those constraints leave nobody (late game with few survivors), they
    are relaxed in order so the game can never deadlock.
    """
    t = game_state.turn
    alive = [p.seat for p in game_state.players if p.alive and p.seat != t.regent_seat]
    prev = t.prev_government or {}
    layers = [
        {prev.get("regent"), prev.get("chambellan"), t.disgraced_player_seat, t.marked_player_seat},
        {prev.get("chambellan"), t.disgraced_player_seat, t.marked_player_seat},
        {prev.get("chambellan"), t.disgraced_player_seat},
        set(),
    ]
    for forbidden in layers:
        seats = [s for s in alive if s not in forbidden]
        if seats:
            return seats
    return []

# Connection manager for WebSocket
class WebSocketManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}
        self.game_states: Dict[str, GameState] = {}
        # Last-activity timestamp per room, used to prune idle rooms from RAM.
        self.last_activity: Dict[str, float] = {}
        # One lock per room: HTTP actions and the bot/timeout ticker never
        # mutate the same room concurrently.
        self.locks: Dict[str, asyncio.Lock] = {}

    def lock_for(self, room_code: str) -> asyncio.Lock:
        lock = self.locks.get(room_code)
        if lock is None:
            lock = asyncio.Lock()
            self.locks[room_code] = lock
        return lock

    def touch_room(self, room_code: str) -> None:
        """Mark a room as active. Called on every authenticated action."""
        self.last_activity[room_code] = _now()

    def prune_idle_rooms(self) -> int:
        """Drop rooms with no activity for longer than ROOM_IDLE_TTL_SECONDS.

        Keeps the in-memory state from growing without bound when players
        abandon rooms and never trigger a clean tear-down.
        """
        now = _now()
        stale = [
            code for code, ts in self.last_activity.items()
            if now - ts > ROOM_IDLE_TTL_SECONDS
        ]
        for code in stale:
            self.game_states.pop(code, None)
            self.active_connections.pop(code, None)
            self.last_activity.pop(code, None)
            self.locks.pop(code, None)
        return len(stale)

    async def connect(self, websocket: WebSocket, room_code: str):
        await websocket.accept()
        if room_code not in self.active_connections:
            self.active_connections[room_code] = []
        self.active_connections[room_code].append(websocket)

    def disconnect(self, websocket: WebSocket, room_code: str):
        conns = self.active_connections.get(room_code)
        if conns and websocket in conns:
            conns.remove(websocket)

    async def broadcast_to_room(self, room_code: str, message: dict):
        if room_code in self.active_connections:
            for connection in list(self.active_connections[room_code]):
                try:
                    await connection.send_text(json.dumps(message))
                except Exception:
                    pass

    # ------------------------------------------------------------------
    # Room / lobby
    # ------------------------------------------------------------------
    def create_deck(self) -> List[DecreeType]:
        deck = [DecreeType.LOYAL] * 6 + [DecreeType.CONJURE] * 11
        random.shuffle(deck)
        return deck

    def create_room(self, room_code: str) -> GameState:
        game_state = GameState(
            room_code=room_code,
            deck=self.create_deck()
        )
        game_state.turn.deck_count = len(game_state.deck)
        self.game_states[room_code] = game_state
        self.last_activity[room_code] = _now()
        return game_state

    def get_game_state(self, room_code: str) -> Optional[GameState]:
        return self.game_states.get(room_code)

    def add_player(self, room_code: str, player_id: str, player_name: str) -> tuple[bool, str]:
        game_state = self.get_game_state(room_code)
        if not game_state:
            return False, "room_not_found"

        # Allow reconnection by id even if room is full / game started
        for p in game_state.players:
            if p.id == player_id:
                p.connected = True
                game_state.last_seen[player_id] = _now()
                return True, "ok"

        if game_state.status != "lobby":
            return False, "game_started"

        if len(game_state.players) >= 10:
            return False, "room_full"

        # Reject duplicate pseudos (case-insensitive, trimmed)
        normalized = (player_name or "").strip().lower()
        if any((p.name or "").strip().lower() == normalized for p in game_state.players):
            return False, "name_taken"

        seat = len(game_state.players) + 1
        player = Player(id=player_id, name=player_name, seat=seat)
        game_state.players.append(player)
        game_state.last_seen[player_id] = _now()
        if not game_state.host_id:
            game_state.host_id = player_id
        game_state.version += 1
        return True, "ok"

    def add_bot(self, game_state: GameState) -> Optional[Player]:
        if game_state.status != "lobby" or len(game_state.players) >= 10:
            return None
        taken = {(p.name or "").strip().lower() for p in game_state.players}
        name = next((n for n in bots.BOT_NAMES if n.lower() not in taken), None)
        if not name:
            name = f"Écuyer {len(game_state.players) + 1}"
        bot = Player(
            id=f"bot-{uuid.uuid4()}",
            name=name,
            seat=len(game_state.players) + 1,
            is_bot=True,
        )
        game_state.players.append(bot)
        game_state.version += 1
        return bot

    def remove_player(self, game_state: GameState, player_id: str) -> bool:
        """Remove a player or bot from the lobby and renumber seats."""
        if game_state.status != "lobby":
            return False
        before = len(game_state.players)
        game_state.players = [p for p in game_state.players if p.id != player_id]
        if len(game_state.players) == before:
            return False
        for i, p in enumerate(game_state.players, start=1):
            p.seat = i
        game_state.last_seen.pop(player_id, None)
        if game_state.host_id == player_id:
            nxt = next((p for p in game_state.players if not p.is_bot), None)
            game_state.host_id = nxt.id if nxt else None
        game_state.version += 1
        return True

    def reset_to_lobby(self, game_state: GameState) -> None:
        """'Rejouer' — same room, same players, fresh game."""
        keep_chat = game_state.turn.chat_messages[-50:]
        game_state.status = "lobby"
        game_state.tracks = GameTracks()
        game_state.turn = TurnState(chat_messages=keep_chat)
        game_state.powers = {
            "investigation_unlocked": False,
            "investigation_used": False,
            "execution_unlocked": False,
            "execution_used": False,
            "executed_once": False,
        }
        game_state.winner = None
        game_state.winner_reason = None
        game_state.deck = self.create_deck()
        game_state.discard = []
        game_state.turn.deck_count = len(game_state.deck)
        game_state.events = []
        game_state.bot_memory = {}
        game_state.bot_next_act = {}
        game_state.phase_key = None
        for p in game_state.players:
            p.role = None
            p.alive = True
        game_state.version += 1

    def start_game(self, room_code: str) -> bool:
        game_state = self.get_game_state(room_code)
        if not game_state or game_state.status != "lobby" or len(game_state.players) < 5:
            return False

        player_count = len(game_state.players)
        # Répartition officielle (livret) : Fidèles / Traîtres / Tyran
        distribution = {5: (3, 1), 6: (4, 1), 7: (4, 2), 8: (5, 2), 9: (5, 3), 10: (6, 3)}
        if player_count not in distribution:
            return False
        n_loyal, n_conj = distribution[player_count]
        roles = [Role.LOYAL] * n_loyal + [Role.CONJURE] * n_conj + [Role.USURPATEUR]
        random.shuffle(roles)
        for player, role in zip(game_state.players, roles):
            player.role = role
            player.alive = True

        # Fresh deck for every game
        game_state.deck = self.create_deck()
        game_state.discard = []
        game_state.turn.deck_count = len(game_state.deck)
        game_state.turn.discard_count = 0

        # Randomize starting King (seat). Previously always seat 1 = room creator.
        alive_seats = [p.seat for p in game_state.players if p.alive]
        game_state.turn.regent_seat = random.choice(alive_seats)

        # Initialize Piste de Défiance (empty, no marks yet)
        game_state.turn.turn_number = 1
        game_state.turn.defiance_counts = {s: 0 for s in alive_seats}
        game_state.turn.defiance_votes = {}
        game_state.turn.marked_player_seat = None
        game_state.turn.defiance_start_time = None

        game_state.status = "in_progress"
        game_state.turn.phase = Phase.NOMINATION
        game_state.events = []
        game_state.bot_memory = {}
        game_state.bot_next_act = {}
        log_event(game_state, "start", f"La partie commence à {player_count} joueurs. "
                  f"{seat_name(game_state, game_state.turn.regent_seat)} est le premier Roi.")
        game_state.version += 1
        return True

    # ------------------------------------------------------------------
    # Rules helpers
    # ------------------------------------------------------------------
    def _ensure_deck(self, game_state: GameState, needed: int) -> None:
        """Remélange la défausse dans la pioche quand il reste trop peu de cartes."""
        if len(game_state.deck) < needed and game_state.discard:
            game_state.deck.extend(game_state.discard)
            game_state.discard = []
            random.shuffle(game_state.deck)
            log_event(game_state, "reshuffle", "La pioche est épuisée : la défausse est remélangée.")
        game_state.turn.deck_count = len(game_state.deck)
        game_state.turn.discard_count = len(game_state.discard)

    def _set_winner(self, game_state: GameState, winner: str, reason: str) -> None:
        game_state.winner = winner
        game_state.winner_reason = reason
        game_state.turn.phase = Phase.ENDGAME
        game_state.status = "finished"
        game_state.turn.active_power = None
        texts = {
            "5_loyal": "Cinq Décrets Loyaux sont adoptés : les Fidèles sauvent la Couronne !",
            "6_conjure": "Six Décrets de Trahison sont adoptés : les Traîtres s'emparent du trône !",
            "tyran_executed": "Le Tyran a été exécuté : les Fidèles triomphent !",
            "tyran_elected": "Le Tyran est élu Conseiller après 3 Trahisons : les Traîtres triomphent !",
        }
        log_event(game_state, "endgame", texts.get(reason, "La partie est terminée."), winner=winner, reason=reason)

    def check_win_conditions(self, game_state: GameState) -> Optional[str]:
        """Sets winner/winner_reason/phase if the game is over; returns the winner."""
        if game_state.winner:
            return game_state.winner
        if game_state.tracks.loyal >= 5:
            self._set_winner(game_state, "FIDELES", "5_loyal")
        elif not any(p.role == Role.USURPATEUR and p.alive for p in game_state.players):
            self._set_winner(game_state, "FIDELES", "tyran_executed")
        elif game_state.tracks.conjure >= 6:
            self._set_winner(game_state, "CONJURES", "6_conjure")
        return game_state.winner

    def _next_regent_seat(self, game_state: GameState, current_seat: int) -> int:
        """Rotate to the next alive King, skipping disgraced and marked players."""
        alive_seats = sorted([p.seat for p in game_state.players if p.alive])
        if not alive_seats:
            return current_seat
        forbidden = set()
        if game_state.turn.disgraced_player_seat:
            forbidden.add(game_state.turn.disgraced_player_seat)
        if game_state.turn.marked_player_seat:
            forbidden.add(game_state.turn.marked_player_seat)
        # Walk the full table (dead seats included) so a dead King still passes
        # the crown to the next living player in seat order.
        all_seats = sorted(p.seat for p in game_state.players)
        idx = all_seats.index(current_seat) if current_seat in all_seats else -1
        n = len(all_seats)
        fallback = None
        for _ in range(n):
            idx = (idx + 1) % n
            candidate = all_seats[idx]
            if candidate not in alive_seats:
                continue
            if fallback is None:
                fallback = candidate
            if candidate not in forbidden:
                return candidate
        return fallback if fallback is not None else alive_seats[0]

    def _advance_to_next_nomination(self, game_state: GameState):
        """Rotate King and enter NOMINATION for the next turn.

        prev_government (term limits) is set when a government is *elected*
        and is deliberately not touched here.
        """
        current_seat = game_state.turn.regent_seat
        next_regent_seat = self._next_regent_seat(game_state, current_seat)

        game_state.turn.regent_seat = next_regent_seat
        game_state.turn.phase = Phase.NOMINATION
        game_state.turn.nominee_seat = None
        game_state.turn.votes = {}
        game_state.turn.turn_number += 1
        # Clear transient power state so the next turn starts clean
        game_state.turn.active_power = None
        game_state.turn.power_result = None
        game_state.turn.last_execution_seat = None

    def _enter_defiance_phase(self, game_state: GameState):
        """Open the Piste de Défiance vote."""
        game_state.turn.phase = Phase.DEFIANCE
        game_state.turn.defiance_votes = {}
        game_state.turn.defiance_start_time = _now()

    def _resolve_defiance(self, game_state: GameState):
        """Tally defiance votes, update counts, set marked player, advance to NOMINATION."""
        # Clear previous turn's mark (its 1-turn effect has been served)
        game_state.turn.marked_player_seat = None

        for target_seat in game_state.turn.defiance_votes.values():
            if target_seat is None:
                continue
            game_state.turn.defiance_counts[target_seat] = (
                game_state.turn.defiance_counts.get(target_seat, 0) + 1
            )

        over = [
            (seat, count) for seat, count in game_state.turn.defiance_counts.items()
            if count >= DEFIANCE_MARK_THRESHOLD
            and any(p.seat == seat and p.alive for p in game_state.players)
        ]
        if over:
            over.sort(key=lambda x: (-x[1], x[0]))
            marked_seat = over[0][0]
            game_state.turn.marked_player_seat = marked_seat
            game_state.turn.defiance_counts[marked_seat] = 0
            log_event(game_state, "marked",
                      f"{seat_name(game_state, marked_seat)} est marqué par la Défiance : "
                      "ni Roi ni Conseiller au prochain tour.", seat=marked_seat)

        game_state.turn.defiance_votes = {}
        game_state.turn.defiance_start_time = None
        self._advance_to_next_nomination(game_state)

    def _start_conseil(self, game_state: GameState):
        game_state.turn.phase = Phase.CONSEIL_ROYAUME
        game_state.turn.conseil_royaume_timer = CONSEIL_DURATION_SECONDS
        game_state.turn.conseil_royaume_start_time = _now()
        game_state.turn.speaking_players = []
        game_state.turn.conseil_ready = []

    async def advance_after_conseil(self, game_state: GameState):
        """Advance game to next phase after Conseil du Royaume ends."""
        game_state.turn.conseil_royaume_timer = None
        game_state.turn.conseil_royaume_start_time = None
        game_state.turn.speaking_players = []
        game_state.turn.conseil_ready = []

        # Pouvoirs du Roi : déclenchés au 2ᵉ et 4ᵉ Décret de Trahison, une seule fois chacun.
        if game_state.tracks.conjure >= 2 and not game_state.powers.get("investigation_used"):
            game_state.powers["investigation_unlocked"] = True
            game_state.turn.phase = Phase.POWER
            game_state.turn.active_power = "INVESTIGATE"
            game_state.turn.power_result = None
            return
        if game_state.tracks.conjure >= 4 and not game_state.powers.get("execution_used"):
            game_state.powers["execution_unlocked"] = True
            game_state.turn.phase = Phase.POWER
            game_state.turn.active_power = "EXECUTE"
            game_state.turn.power_result = None
            return

        self._flow_to_next_turn_phase(game_state)

    def _flow_to_next_turn_phase(self, game_state: GameState):
        """After decree resolution + Conseil + (optional) Power, enter Défiance or Nomination."""
        if game_state.turn.turn_number >= 2:
            self._enter_defiance_phase(game_state)
        else:
            self._advance_to_next_nomination(game_state)

    def _advance_after_power(self, game_state: GameState):
        """Exit POWER phase cleanly and flow to next turn phase."""
        game_state.turn.active_power = None
        game_state.turn.power_result = None
        self._flow_to_next_turn_phase(game_state)

    # ------------------------------------------------------------------
    # Presence / phase clock
    # ------------------------------------------------------------------
    def is_present(self, game_state: GameState, player: Player) -> bool:
        if player.is_bot:
            return True
        seen = game_state.last_seen.get(player.id)
        return seen is not None and (_now() - seen) <= AWAY_AFTER_SECONDS

    def sync_phase_clock(self, game_state: GameState) -> bool:
        """Reset the phase clock whenever the actionable situation changes."""
        t = game_state.turn
        key = f"{game_state.status}|{t.phase}|{t.turn_number}|{t.regent_seat}|{t.nominee_seat}|{t.active_power}|{t.power_result is not None}|{game_state.tracks.crisis}"
        if key != game_state.phase_key:
            game_state.phase_key = key
            t.phase_started_at = _now()
            game_state.bot_next_act = {}
            return True
        return False

    def pending_actor_ids(self, game_state: GameState) -> List[str]:
        """Players who must act for the game to progress."""
        t = game_state.turn
        if game_state.status != "in_progress":
            return []
        alive = [p for p in game_state.players if p.alive]
        by_seat = {p.seat: p for p in alive}
        if t.phase == Phase.NOMINATION:
            p = by_seat.get(t.regent_seat)
            return [p.id] if p else []
        if t.phase == Phase.VOTE:
            return [p.id for p in alive if p.id not in t.votes]
        if t.phase == Phase.LEGIS_REGENT:
            p = by_seat.get(t.regent_seat)
            return [p.id] if p else []
        if t.phase == Phase.LEGIS_CHAMBELLAN:
            p = by_seat.get(t.nominee_seat)
            return [p.id] if p else []
        if t.phase == Phase.POWER:
            p = by_seat.get(t.regent_seat)
            return [p.id] if p else []
        if t.phase == Phase.DEFIANCE:
            return [p.id for p in alive if p.id not in t.defiance_votes]
        if t.phase == Phase.CONSEIL_ROYAUME:
            return [p.id for p in alive if p.id not in t.conseil_ready]
        return []


manager = WebSocketManager()


# --- Audio relay for Conseil du Royaume voice chat ---
# Wire format for binary frames relayed between clients:
#   bytes 0      : sender seat (uint8, 1-10)
#   bytes 1      : reserved (0)
#   bytes 2-3    : sender sample rate, big-endian uint16 (e.g. 48000)
#   bytes 4..    : Int16 little-endian PCM mono payload
class AudioRelay:
    def __init__(self):
        # room_code -> { player_id -> WebSocket }
        self.connections: Dict[str, Dict[str, WebSocket]] = {}

    async def connect(self, room_code: str, player_id: str, websocket: WebSocket):
        await websocket.accept()
        self.connections.setdefault(room_code, {})[player_id] = websocket

    def disconnect(self, room_code: str, player_id: str):
        room = self.connections.get(room_code)
        if not room:
            return
        room.pop(player_id, None)
        if not room:
            self.connections.pop(room_code, None)

    async def relay(self, room_code: str, sender_id: str, payload: bytes):
        room = self.connections.get(room_code)
        if not room:
            return
        # Snapshot to avoid mutation during iteration
        for pid, ws in list(room.items()):
            if pid == sender_id:
                continue
            try:
                await ws.send_bytes(payload)
            except Exception:
                # Drop stale connections silently; the disconnect handler will clean up
                pass


audio_relay = AudioRelay()

# API Routes
@api_router.get("/")
async def root():
    return {"message": "Secretus Regnum API"}


def _sanitize_name(raw: str) -> str:
    """Strip control chars and length-bound a display name."""
    if not isinstance(raw, str):
        return ""
    # Strip control characters (keep printable + common whitespace)
    cleaned = "".join(ch for ch in raw if ch == " " or (ch.isprintable() and not ch.isspace())).strip()
    return cleaned[:MAX_PLAYER_NAME_LEN]


class AnonymousAuthBody(BaseModel):
    name: str


@api_router.post("/auth/anonymous")
@limiter.limit("20/minute")
async def create_anonymous_user(request: Request, body: AnonymousAuthBody):
    """Issue a signed JWT for an anonymous player.

    The token carries the generated user id and the display name. It is
    required on every subsequent action endpoint via the Authorization
    header, and on WebSocket connections via a ?token= query parameter.
    """
    name = _sanitize_name(body.name)
    if not name:
        raise HTTPException(status_code=400, detail="Nom invalide")
    user_id, name, token = issue_player_token(name)
    return {"userId": user_id, "name": name, "token": token}


@api_router.post("/rooms")
@limiter.limit("10/minute")
async def create_room(request: Request, identity: PlayerIdentity = Depends(require_player)):
    """Create a new room. Requires authentication to prevent anonymous room-spam."""
    room_code = ''.join(random.choices('ABCDEFGHIJKLMNOPQRSTUVWXYZ', k=6))
    manager.create_room(room_code)
    return {"code": room_code}


@api_router.get("/rooms/{room_code}")
async def get_room(room_code: str):
    game_state = manager.get_game_state(room_code)
    if not game_state:
        raise HTTPException(status_code=404, detail="Room not found")

    return {
        "code": room_code,
        "status": game_state.status,
        "host_id": game_state.host_id,
        "version": game_state.version,
        "players": [
            {"id": p.id, "name": p.name, "seat": p.seat, "connected": manager.is_present(game_state, p),
             "is_bot": p.is_bot, "is_host": p.id == game_state.host_id}
            for p in game_state.players
        ],
    }


@api_router.post("/rooms/{room_code}/join")
@limiter.limit("30/minute")
async def join_room(
    request: Request,
    room_code: str,
    identity: PlayerIdentity = Depends(require_player),
):
    """Join a room. The player id and display name come from the JWT; the
    client cannot spoof someone else's seat by swapping a query param."""
    manager.touch_room(room_code)
    player_name = _sanitize_name(identity.name)
    if not player_name:
        raise HTTPException(status_code=400, detail="Nom invalide")
    success, reason = manager.add_player(room_code, identity.user_id, player_name)
    if not success:
        detail = {
            "room_not_found": "Room not found",
            "room_full": "La salle est pleine",
            "game_started": "La partie a déjà commencé",
            "name_taken": "Ce pseudo est déjà pris dans cette partie",
        }.get(reason, "Cannot join room")
        raise HTTPException(status_code=400, detail=detail)

    game_state = manager.get_game_state(room_code)
    await manager.broadcast_to_room(room_code, {
        "type": "player_joined",
        "players": [{"id": p.id, "name": p.name, "seat": p.seat, "connected": p.connected} for p in game_state.players]
    })
    return {"success": True}


class ChatBody(BaseModel):
    message: str


# Chat endpoint
@api_router.post("/rooms/{room_code}/chat")
@limiter.limit("30/minute")
async def send_chat_message(
    request: Request,
    room_code: str,
    body: ChatBody,
    identity: PlayerIdentity = Depends(require_player),
):
    """Send a chat message to all players in the room"""
    manager.touch_room(room_code)
    game_state = manager.get_game_state(room_code)
    if not game_state:
        raise HTTPException(status_code=404, detail="Room not found")

    # Enforce room membership from the authenticated identity. Previously any
    # client could POST /chat with an arbitrary player_id in the query string.
    player = next((p for p in game_state.players if p.id == identity.user_id), None)
    if not player:
        raise HTTPException(status_code=403, detail="Not a member of this room")

    # Bound message size to prevent memory exhaustion on the in-RAM buffer.
    message = (body.message or "").strip()
    if not message:
        raise HTTPException(status_code=400, detail="Empty message")
    if len(message) > MAX_CHAT_MESSAGE_LEN:
        message = message[:MAX_CHAT_MESSAGE_LEN]

    game_state.last_seen[player.id] = _now()
    chat_message = post_chat(game_state, player, message)
    game_state.version += 1

    await manager.broadcast_to_room(room_code, {
        "type": "chat_message",
        **chat_message
    })

    return {"success": True, "message": chat_message}


class ActionBody(BaseModel):
    action_type: str
    payload: Dict[str, Any] = {}


def post_chat(game_state: GameState, player: Player, text: str, kind: str = "player") -> Dict[str, Any]:
    msg = {
        "id": (game_state.turn.chat_messages[-1]["id"] + 1) if game_state.turn.chat_messages else 1,
        "player_id": player.id,
        "player_name": player.name,
        "message": text[:MAX_CHAT_MESSAGE_LEN],
        "timestamp": datetime.now().isoformat(),
        "type": kind,
        "is_bot": player.is_bot,
    }
    game_state.turn.chat_messages.append(msg)
    if len(game_state.turn.chat_messages) > 500:
        game_state.turn.chat_messages = game_state.turn.chat_messages[-500:]
    return msg


def _bad_request(detail: str):
    raise HTTPException(status_code=400, detail=detail)


async def perform_action(
    room_code: str,
    game_state: GameState,
    player: Player,
    action_type: str,
    payload: Dict[str, Any],
    auto: bool = False,
) -> Dict[str, Any]:
    """Apply one game action. Shared by human requests, bots and AFK takeover.

    Raises HTTPException(400) with a French message on invalid actions.
    The caller must hold manager.lock_for(room_code).
    """
    t = game_state.turn
    player_id = player.id
    by_seat = {p.seat: p for p in game_state.players}

    # ---------------- Lobby / host actions ----------------
    if action_type in ("ADD_BOT", "REMOVE_PLAYER", "RESTART"):
        if player_id != game_state.host_id:
            _bad_request("Seul l'hôte de la salle peut faire cela.")
        if action_type == "ADD_BOT":
            if game_state.status != "lobby":
                _bad_request("La partie a déjà commencé.")
            if not manager.add_bot(game_state):
                _bad_request("La salle est pleine (10 joueurs maximum).")
        elif action_type == "REMOVE_PLAYER":
            target_id = payload.get("playerId")
            if not target_id or target_id == player_id:
                _bad_request("Joueur invalide.")
            if not manager.remove_player(game_state, target_id):
                _bad_request("Impossible de retirer ce joueur maintenant.")
        else:  # RESTART
            if t.phase != Phase.ENDGAME:
                _bad_request("La partie n'est pas terminée.")
            manager.reset_to_lobby(game_state)
        await manager.broadcast_to_room(room_code, {"type": "lobby_update", "version": game_state.version})
        return {"success": True, "version": game_state.version}

    if action_type == "LEAVE":
        if game_state.status != "lobby":
            _bad_request("Impossible de quitter une partie en cours.")
        manager.remove_player(game_state, player_id)
        await manager.broadcast_to_room(room_code, {"type": "lobby_update", "version": game_state.version})
        return {"success": True, "version": game_state.version}

    if game_state.status != "in_progress" or t.phase == Phase.ENDGAME:
        _bad_request("La partie n'est pas en cours.")

    who = player.name + (" (remplacé)" if auto and not player.is_bot else "")

    if action_type == "NOMINATE":
        if t.phase != Phase.NOMINATION:
            _bad_request("Ce n'est pas la phase de nomination.")
        if player.seat != t.regent_seat:
            _bad_request("Seul le Roi peut nommer un Conseiller.")
        try:
            nominee_seat = int(payload.get("nomineeSeat"))
        except (TypeError, ValueError):
            _bad_request("Conseiller invalide.")
        if nominee_seat not in eligible_nominee_seats(game_state):
            _bad_request("Ce joueur ne peut pas être nommé Conseiller.")

        t.nominee_seat = nominee_seat
        t.phase = Phase.VOTE
        t.votes = {}
        log_event(game_state, "nomination",
                  f"{who} (Roi) propose {seat_name(game_state, nominee_seat)} comme Conseiller.",
                  regent_seat=t.regent_seat, nominee_seat=nominee_seat)
        game_state.version += 1
        await manager.broadcast_to_room(room_code, {
            "type": "game_update", "phase": t.phase, "nominee_seat": nominee_seat, "version": game_state.version,
        })

    elif action_type == "VOTE":
        # Livret : tous les joueurs vivants votent (Roi et Conseiller compris).
        if t.phase != Phase.VOTE:
            _bad_request("Ce n'est pas la phase de vote.")
        if not player.alive:
            _bad_request("Les morts ne votent pas.")
        vote = payload.get("vote")
        if vote not in ("oui", "non"):
            _bad_request("Vote invalide.")
        t.votes[player_id] = vote

        alive_players = [p for p in game_state.players if p.alive]
        if all(p.id in t.votes for p in alive_players):
            yes_votes = sum(1 for v in t.votes.values() if v == "oui")
            no_votes = len(t.votes) - yes_votes
            elected = yes_votes > no_votes
            ballots = {str(p.seat): t.votes[p.id] for p in alive_players}
            regent_seat, nominee_seat = t.regent_seat, t.nominee_seat
            t.last_vote = {
                "turn": t.turn_number, "regent_seat": regent_seat, "nominee_seat": nominee_seat,
                "result": "elected" if elected else "rejected",
                "yes": yes_votes, "no": no_votes, "ballots": ballots, "ts": _now(),
            }
            log_event(game_state, "vote",
                      f"Gouvernement {seat_name(game_state, regent_seat)} / {seat_name(game_state, nominee_seat)} "
                      f"{'élu' if elected else 'rejeté'} ({yes_votes} oui, {no_votes} non).",
                      result="elected" if elected else "rejected", ballots=ballots,
                      regent_seat=regent_seat, nominee_seat=nominee_seat)

            if elected:
                game_state.tracks.crisis = 0
                t.disgraced_player_seat = None
                t.peoples_anger_triggered = False
                t.prev_government = {"regent": regent_seat, "chambellan": nominee_seat}
                t.votes = {}
                nominee = by_seat.get(nominee_seat)
                # Victoire des Traîtres : Tyran élu Conseiller après 3+ Trahisons
                if game_state.tracks.conjure >= 3 and nominee and nominee.role == Role.USURPATEUR:
                    manager._set_winner(game_state, "CONJURES", "tyran_elected")
                else:
                    if game_state.tracks.conjure >= 3:
                        log_event(game_state, "info",
                                  f"{seat_name(game_state, nominee_seat)} n'est pas le Tyran.", seat=nominee_seat)
                    manager._ensure_deck(game_state, 3)
                    t.legislative_cards = game_state.deck[:3]
                    game_state.deck = game_state.deck[3:]
                    t.deck_count = len(game_state.deck)
                    t.phase = Phase.LEGIS_REGENT
            else:
                game_state.tracks.crisis += 1
                t.votes = {}
                t.nominee_seat = None
                if game_state.tracks.crisis >= 3:
                    # COLÈRE DU PEUPLE : décret du dessus adopté, Roi désavoué
                    manager._ensure_deck(game_state, 1)
                    if game_state.deck:
                        top_card = game_state.deck.pop(0)
                        t.deck_count = len(game_state.deck)
                        if top_card == DecreeType.LOYAL:
                            game_state.tracks.loyal += 1
                        else:
                            game_state.tracks.conjure += 1
                        t.last_decree = {"turn": t.turn_number, "type": top_card.value, "auto": True,
                                         "regent_seat": None, "chambellan_seat": None, "ts": _now()}
                        log_event(game_state, "decree",
                                  f"Colère du Peuple ! Le peuple impose un Décret "
                                  f"{'Loyal' if top_card == DecreeType.LOYAL else 'de Trahison'}. "
                                  f"{seat_name(game_state, regent_seat)} est désavoué.",
                                  type=top_card.value, auto=True, regent_seat=None, chambellan_seat=None)
                    t.disgraced_player_seat = regent_seat
                    t.peoples_anger_triggered = True
                    game_state.tracks.crisis = 0
                if not manager.check_win_conditions(game_state):
                    t.regent_seat = manager._next_regent_seat(game_state, t.regent_seat)
                    t.phase = Phase.NOMINATION
            game_state.version += 1
            await manager.broadcast_to_room(room_code, {
                "type": "vote_result", "result": "elected" if elected else "rejected",
                "yes_votes": yes_votes, "no_votes": no_votes, "new_phase": t.phase,
                "tracks": game_state.tracks.model_dump(), "regent_seat": t.regent_seat,
                "winner": game_state.winner, "version": game_state.version,
            })
        else:
            game_state.version += 1
            await manager.broadcast_to_room(room_code, {
                "type": "vote_progress", "votes_count": len(t.votes),
                "total_needed": len(alive_players), "version": game_state.version,
            })

    elif action_type == "DISCARD":
        if t.phase == Phase.LEGIS_REGENT:
            if player.seat != t.regent_seat:
                _bad_request("Seul le Roi peut défausser maintenant.")
            card_index = payload.get("cardId")
            if not isinstance(card_index, int) or not (0 <= card_index < len(t.legislative_cards)):
                _bad_request("Carte invalide.")
            discarded_card = t.legislative_cards.pop(card_index)
            game_state.discard.append(discarded_card)
            t.discard_count = len(game_state.discard)
            t.phase = Phase.LEGIS_CHAMBELLAN
            game_state.version += 1
            await manager.broadcast_to_room(room_code, {
                "type": "phase_change", "new_phase": t.phase, "version": game_state.version,
            })

        elif t.phase == Phase.LEGIS_CHAMBELLAN:
            if player.seat != t.nominee_seat:
                _bad_request("Seul le Conseiller peut choisir maintenant.")
            card_index = payload.get("cardId")
            if not isinstance(card_index, int) or not (0 <= card_index < len(t.legislative_cards)):
                _bad_request("Carte invalide.")
            # The chosen card is adopted, the other is discarded
            adopted_card = t.legislative_cards.pop(card_index)
            game_state.discard.extend(t.legislative_cards)
            t.legislative_cards = []
            t.discard_count = len(game_state.discard)
            if adopted_card == DecreeType.LOYAL:
                game_state.tracks.loyal += 1
            else:
                game_state.tracks.conjure += 1
            decree = {"turn": t.turn_number, "type": adopted_card.value, "auto": False,
                      "regent_seat": t.regent_seat, "chambellan_seat": t.nominee_seat, "ts": _now()}
            t.last_decree = decree
            log_event(game_state, "decree",
                      f"Décret {'Loyal' if adopted_card == DecreeType.LOYAL else 'de Trahison'} adopté "
                      f"par {seat_name(game_state, t.regent_seat)} et {seat_name(game_state, t.nominee_seat)}.",
                      type=adopted_card.value, auto=False,
                      regent_seat=t.regent_seat, chambellan_seat=t.nominee_seat)

            if not manager.check_win_conditions(game_state):
                manager._ensure_deck(game_state, 3)
                manager._start_conseil(game_state)
                # Bots in the government announce what they saw (truth or lies)
                for seat in (decree["regent_seat"], decree["chambellan_seat"]):
                    gov = by_seat.get(seat)
                    if gov and gov.alive and gov.is_bot:
                        claim = bots.decree_claims(game_state, gov, decree)
                        if claim:
                            post_chat(game_state, gov, claim)

            t.votes = {}
            game_state.version += 1
            await manager.broadcast_to_room(room_code, {
                "type": "legislation_enacted", "adopted_card": adopted_card,
                "new_tracks": game_state.tracks.model_dump(), "new_phase": t.phase,
                "regent_seat": t.regent_seat, "winner": game_state.winner, "version": game_state.version,
            })
        else:
            _bad_request("Ce n'est pas la phase législative.")

    elif action_type == "CONSEIL_READY":
        if t.phase != Phase.CONSEIL_ROYAUME:
            return {"success": True, "stale": True, "version": game_state.version}
        if player_id not in t.conseil_ready:
            t.conseil_ready.append(player_id)
        game_state.version += 1
        await maybe_end_conseil(room_code, game_state)

    elif action_type == "DEFIANCE_VOTE":
        # Race-tolerant: a late click after auto-resolution is a no-op.
        if t.phase != Phase.DEFIANCE:
            return {"success": True, "stale": True, "version": game_state.version}
        if not player.alive:
            _bad_request("Les morts ne votent pas.")
        raw_target = payload.get("targetSeat")
        target_seat: Optional[int] = None
        if raw_target is not None:
            try:
                target_seat = int(raw_target)
            except (TypeError, ValueError):
                _bad_request("Cible invalide.")
            target_player = by_seat.get(target_seat)
            if not target_player or not target_player.alive:
                _bad_request("Cible invalide.")
            if target_seat == player.seat:
                _bad_request("Vous ne pouvez pas vous désigner vous-même.")
        t.defiance_votes[player_id] = target_seat
        if all(p.id in t.defiance_votes for p in game_state.players if p.alive):
            manager._resolve_defiance(game_state)
        game_state.version += 1
        await manager.broadcast_to_room(room_code, {
            "type": "game_update", "data": "defiance_vote", "phase": t.phase, "version": game_state.version,
        })

    elif action_type == "INVESTIGATE":
        if t.phase != Phase.POWER or t.active_power != "INVESTIGATE":
            _bad_request("Ce n'est pas le moment d'enquêter.")
        if player.seat != t.regent_seat:
            _bad_request("Seul le Roi peut enquêter.")
        if t.power_result is not None:
            _bad_request("L'enquête a déjà eu lieu.")
        try:
            target_seat = int(payload.get("targetSeat"))
        except (TypeError, ValueError):
            _bad_request("Cible invalide.")
        target = by_seat.get(target_seat)
        if not target or not target.alive or target_seat == player.seat:
            _bad_request("Cible invalide.")
        # Camp révélé : Fidèle vs Traître (le Tyran apparaît comme Traître).
        camp = "Fidèle" if target.role == Role.LOYAL else "Traître"
        t.power_result = {"target_seat": target_seat, "target_name": target.name, "camp": camp}
        game_state.powers["investigation_used"] = True
        bots.memory(game_state, player)["investigations"][str(target_seat)] = camp
        log_event(game_state, "investigate",
                  f"{who} (Roi) enquête sur {target.name}.", regent_seat=player.seat, target_seat=target_seat)
        if player.is_bot:
            post_chat(game_state, player, bots.investigation_claim(game_state, player, target_seat, camp))
        game_state.version += 1
        await manager.broadcast_to_room(room_code, {
            "type": "game_update", "data": "investigation_done", "version": game_state.version,
        })

    elif action_type == "EXECUTE":
        if t.phase != Phase.POWER or t.active_power != "EXECUTE":
            _bad_request("Ce n'est pas le moment d'exécuter.")
        if player.seat != t.regent_seat:
            _bad_request("Seul le Roi peut exécuter.")
        try:
            target_seat = int(payload.get("targetSeat"))
        except (TypeError, ValueError):
            _bad_request("Cible invalide.")
        target = by_seat.get(target_seat)
        if not target or not target.alive or target_seat == player.seat:
            _bad_request("Cible invalide.")
        target.alive = False
        game_state.powers["execution_used"] = True
        game_state.powers["executed_once"] = True
        t.last_execution_seat = target_seat
        t.speaking_players = [s for s in t.speaking_players if s != target_seat]
        log_event(game_state, "execute", f"{who} (Roi) fait exécuter {target.name}.",
                  regent_seat=player.seat, target_seat=target_seat)
        if not manager.check_win_conditions(game_state):
            log_event(game_state, "info", f"{target.name} n'était pas le Tyran.", seat=target_seat)
            manager._advance_after_power(game_state)
        game_state.version += 1
        await manager.broadcast_to_room(room_code, {
            "type": "game_update", "data": "execution_done", "executed_seat": target_seat,
            "winner": game_state.winner, "version": game_state.version,
        })

    elif action_type == "ACK_POWER":
        if t.phase != Phase.POWER:
            return {"success": True, "stale": True, "version": game_state.version}
        if player.seat != t.regent_seat:
            _bad_request("Seul le Roi peut fermer l'enquête.")
        if t.active_power != "INVESTIGATE" or t.power_result is None:
            _bad_request("Aucun résultat à fermer.")
        manager._advance_after_power(game_state)
        game_state.version += 1
        await manager.broadcast_to_room(room_code, {
            "type": "game_update", "data": "power_acknowledged", "version": game_state.version,
        })

    elif action_type == "SPEAK_TOGGLE":
        if not player.alive:
            _bad_request("Les morts ne parlent pas.")
        if player.seat in t.speaking_players:
            t.speaking_players.remove(player.seat)
        else:
            t.speaking_players.append(player.seat)
        game_state.version += 1
        await manager.broadcast_to_room(room_code, {
            "type": "game_update", "data": "speaking_update", "version": game_state.version,
        })

    else:
        _bad_request("Action inconnue.")

    manager.sync_phase_clock(game_state)
    return {"success": True, "version": game_state.version}


async def maybe_end_conseil(room_code: str, game_state: GameState) -> None:
    """End the Conseil early once every present, living human is ready."""
    t = game_state.turn
    if t.phase != Phase.CONSEIL_ROYAUME:
        return
    humans = [p for p in game_state.players if p.alive and not p.is_bot and manager.is_present(game_state, p)]
    expired = t.conseil_royaume_start_time and (_now() - t.conseil_royaume_start_time) >= CONSEIL_DURATION_SECONDS
    all_ready = all(p.id in t.conseil_ready for p in humans)
    if expired or all_ready:
        await manager.advance_after_conseil(game_state)
        game_state.version += 1
        manager.sync_phase_clock(game_state)
        await manager.broadcast_to_room(room_code, {
            "type": "game_update", "data": "conseil_end", "version": game_state.version,
        })


# ----------------------------------------------------------------------
# Ticker: timeouts, bots and AFK takeover
# ----------------------------------------------------------------------
async def tick_room(room_code: str, game_state: GameState) -> bool:
    """Advance one room by at most one automatic step. Returns True if something happened."""
    now = _now()
    t = game_state.turn
    manager.sync_phase_clock(game_state)
    if game_state.status != "in_progress" or t.phase == Phase.ENDGAME:
        return False

    # Phase timeouts
    if t.phase == Phase.DEFIANCE and t.defiance_start_time and now - t.defiance_start_time >= DEFIANCE_DURATION_SECONDS:
        manager._resolve_defiance(game_state)
        game_state.version += 1
        manager.sync_phase_clock(game_state)
        await manager.broadcast_to_room(room_code, {"type": "game_update", "data": "defiance_timeout",
                                                    "version": game_state.version})
        return True
    if t.phase == Phase.CONSEIL_ROYAUME:
        before = game_state.version
        await maybe_end_conseil(room_code, game_state)
        if game_state.version != before:
            return True

    # Bot chatter during the Conseil
    if t.phase == Phase.CONSEIL_ROYAUME and t.conseil_royaume_start_time:
        for p in game_state.players:
            if p.is_bot and p.alive:
                mem = bots.memory(game_state, p)
                key = f"conseil-{t.turn_number}"
                if key not in mem["claims_done"] and now - t.conseil_royaume_start_time >= mem.setdefault("chat_delay", random.uniform(4, 12)):
                    mem["claims_done"].append(key)
                    mem.pop("chat_delay", None)
                    line = bots.accusation(game_state, p)
                    if line:
                        post_chat(game_state, p, line)
                        game_state.version += 1

    started = t.phase_started_at or now
    for pid in manager.pending_actor_ids(game_state):
        player = next((p for p in game_state.players if p.id == pid), None)
        if not player:
            continue
        if player.is_bot:
            due = game_state.bot_next_act.setdefault(pid, now + random.uniform(*BOT_THINK_SECONDS))
            if now < due:
                continue
            auto = False
        else:
            # Conseil / Défiance already have their own timers: never take over there.
            if t.phase in (Phase.CONSEIL_ROYAUME, Phase.DEFIANCE):
                continue
            away = not manager.is_present(game_state, player)
            waited = now - started
            if not ((away and waited >= AWAY_GRACE_SECONDS) or waited >= AFK_ACTION_TIMEOUT_SECONDS):
                continue
            auto = True

        decision = bots.decide(game_state, player, eligible_nominee_seats(game_state))
        if not decision:
            continue
        action_type, payload = decision
        try:
            if auto:
                log_event(game_state, "afk", f"{player.name} tarde à agir : le destin choisit à sa place.",
                          seat=player.seat)
            await perform_action(room_code, game_state, player, action_type, payload, auto=auto)
        except HTTPException as e:
            logging.getLogger(__name__).warning("bot action %s failed for %s: %s", action_type, player.name, e.detail)
            game_state.bot_next_act[pid] = now + 2
            continue
        return True
    return False


async def ticker_loop():
    while True:
        try:
            await asyncio.sleep(1.0)
            for code, gs in list(manager.game_states.items()):
                if gs.status != "in_progress":
                    continue
                async with manager.lock_for(code):
                    await tick_room(code, gs)
        except asyncio.CancelledError:
            raise
        except Exception as e:  # never let the ticker die
            logging.getLogger(__name__).exception("ticker error: %s", e)


@api_router.post("/rooms/{room_code}/action")
async def handle_game_action(
    room_code: str,
    body: ActionBody,
    identity: PlayerIdentity = Depends(require_player),
):
    """Handle game actions. The acting player is derived from the JWT."""
    manager.touch_room(room_code)
    game_state = manager.get_game_state(room_code)
    if not game_state:
        raise HTTPException(status_code=404, detail="Salle introuvable")
    async with manager.lock_for(room_code):
        player = next((p for p in game_state.players if p.id == identity.user_id), None)
        if not player:
            raise HTTPException(status_code=403, detail="Vous n'êtes pas membre de cette salle")
        game_state.last_seen[player.id] = _now()
        try:
            return await perform_action(room_code, game_state, player, body.action_type, body.payload or {})
        except HTTPException:
            raise
        except Exception as e:
            logging.getLogger(__name__).exception("action failed")
            raise HTTPException(status_code=500, detail="Erreur interne du serveur")


def _public_player(game_state: GameState, p: Player, reveal: bool) -> Dict[str, Any]:
    d = {
        "id": p.id, "name": p.name, "seat": p.seat, "alive": p.alive,
        "connected": manager.is_present(game_state, p), "is_bot": p.is_bot,
        "is_host": p.id == game_state.host_id,
    }
    if reveal:
        d["role"] = p.role
    return d


@api_router.get("/rooms/{room_code}/game_state")
async def get_game_state(
    room_code: str,
    identity: PlayerIdentity = Depends(require_player),
):
    """Get current game state for the caller (identified by JWT only)."""
    manager.touch_room(room_code)
    game_state = manager.get_game_state(room_code)
    if not game_state:
        raise HTTPException(status_code=404, detail="Salle introuvable")

    player_id = identity.user_id
    player = next((p for p in game_state.players if p.id == player_id), None)
    if not player:
        raise HTTPException(status_code=403, detail="Vous n'êtes pas membre de cette salle")
    game_state.last_seen[player_id] = _now()
    t = game_state.turn

    legislative_cards = []
    if t.phase == Phase.LEGIS_REGENT and player.seat == t.regent_seat:
        legislative_cards = t.legislative_cards
    elif t.phase == Phase.LEGIS_CHAMBELLAN and player.seat == t.nominee_seat:
        legislative_cards = t.legislative_cards

    # Règle Dark Oath : les Traîtres connaissent les autres Traîtres et le Tyran ;
    # le Tyran et les Fidèles ne connaissent personne.
    teammates = []
    if player.role == Role.CONJURE:
        teammates = [
            {"seat": p.seat, "name": p.name, "role": p.role}
            for p in game_state.players
            if p.id != player.id and p.role in (Role.CONJURE, Role.USURPATEUR)
        ]

    reveal = t.phase == Phase.ENDGAME
    return {
        "status": game_state.status,
        "phase": t.phase,
        "server_time": _now(),
        "phase_started_at": t.phase_started_at,
        "afk_timeout": AFK_ACTION_TIMEOUT_SECONDS,
        "host_id": game_state.host_id,
        "regent_seat": t.regent_seat,
        "nominee_seat": t.nominee_seat,
        "prev_government": t.prev_government,
        "eligible_nominee_seats": eligible_nominee_seats(game_state) if t.phase == Phase.NOMINATION else [],
        # Votes are secret until everyone has voted: only who has voted is public.
        "votes_cast": list(t.votes.keys()),
        "my_vote": t.votes.get(player_id),
        "last_vote": t.last_vote,
        "last_decree": t.last_decree,
        "tracks": game_state.tracks.model_dump(),
        "crisis": game_state.tracks.crisis,
        "deck_count": len(game_state.deck),
        "discard_count": len(game_state.discard),
        "your_role": player.role if player.role else None,
        "your_seat": player.seat,
        "teammates": teammates,
        "players": [_public_player(game_state, p, reveal) for p in game_state.players],
        "winner": game_state.winner,
        "winner_reason": game_state.winner_reason,
        "version": game_state.version,
        "legislative_cards": legislative_cards,
        "disgraced_player_seat": t.disgraced_player_seat,
        "peoples_anger_triggered": t.peoples_anger_triggered,
        "conseil_royaume_timer": t.conseil_royaume_timer,
        "conseil_royaume_start_time": t.conseil_royaume_start_time,
        "conseil_duration": CONSEIL_DURATION_SECONDS,
        "conseil_ready": t.conseil_ready,
        "speaking_players": t.speaking_players,
        # Piste de Défiance
        "turn_number": t.turn_number,
        "defiance_counts": t.defiance_counts,
        "defiance_voted_ids": list(t.defiance_votes.keys()),
        "defiance_my_target": t.defiance_votes.get(player_id),
        "defiance_has_voted": player_id in t.defiance_votes,
        "marked_player_seat": t.marked_player_seat,
        "defiance_start_time": t.defiance_start_time,
        "defiance_duration": DEFIANCE_DURATION_SECONDS,
        "defiance_threshold": DEFIANCE_MARK_THRESHOLD,
        # Pouvoir du Roi — active_power visible à tous, power_result uniquement au Roi
        "active_power": t.active_power,
        "power_result": (
            t.power_result
            if t.active_power == "INVESTIGATE" and player.seat == t.regent_seat
            else None
        ),
        "my_investigations": bots.memory(game_state, player)["investigations"],
        "last_execution_seat": t.last_execution_seat,
        "powers": game_state.powers,
        "events": game_state.events[-120:],
    }


@api_router.post("/rooms/{room_code}/start")
async def start_game(
    room_code: str,
    identity: PlayerIdentity = Depends(require_player),
):
    manager.touch_room(room_code)
    game_state = manager.get_game_state(room_code)
    if not game_state:
        raise HTTPException(status_code=404, detail="Salle introuvable")
    async with manager.lock_for(room_code):
        if not any(p.id == identity.user_id for p in game_state.players):
            raise HTTPException(status_code=403, detail="Vous n'êtes pas membre de cette salle")
        if game_state.host_id and identity.user_id != game_state.host_id:
            raise HTTPException(status_code=403, detail="Seul l'hôte peut lancer la partie")
        if not manager.start_game(room_code):
            raise HTTPException(status_code=400, detail="Impossible de lancer : il faut entre 5 et 10 joueurs")
        manager.sync_phase_clock(game_state)

    try:
        admin_stats.increment("games_played")
    except Exception as e:
        logging.warning(f"Could not increment games_played stat: {e}")

    await manager.broadcast_to_room(room_code, {
        "type": "game_started",
        "phase": game_state.turn.phase,
        "regent_seat": game_state.turn.regent_seat,
        "tracks": game_state.tracks.model_dump(),
        "version": game_state.version,
    })
    return {"success": True}


# === Admin Dashboard ===

class AdminLoginBody(BaseModel):
    username: str
    password: str


def _require_admin(authorization: Optional[str]):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    token = authorization.removeprefix("Bearer ").strip()
    if not admin_stats.verify_token(token):
        raise HTTPException(status_code=401, detail="Invalid or expired token")


@api_router.post("/track/visit")
@limiter.limit("30/minute")
async def track_visit(request: Request):
    """Public endpoint: called by the landing page to count a visit."""
    stats = admin_stats.increment("visits")
    return {"ok": True, "visits": stats["visits"]}


@api_router.post("/admin/login")
@limiter.limit("5/minute")
async def admin_login(request: Request, body: AdminLoginBody):
    if not admin_stats.check_credentials(body.username, body.password):
        raise HTTPException(status_code=401, detail="Identifiants invalides")
    return {"token": admin_stats.issue_token()}


@api_router.get("/admin/stats")
async def admin_get_stats(authorization: Optional[str] = Header(None)):
    _require_admin(authorization)
    return admin_stats.get_stats()


@api_router.post("/admin/stats/reset")
async def admin_reset_stats(authorization: Optional[str] = Header(None)):
    _require_admin(authorization)
    return admin_stats.reset_stats()

# Duplicate chat endpoint removed - using the first implementation

# Get chat history endpoint
@api_router.get("/rooms/{room_code}/chat")
async def get_chat_history(
    room_code: str,
    identity: PlayerIdentity = Depends(require_player),
):
    """Get chat history for a room — members only."""
    manager.touch_room(room_code)
    game_state = manager.get_game_state(room_code)
    if not game_state:
        raise HTTPException(status_code=404, detail="Room not found")

    player = next((p for p in game_state.players if p.id == identity.user_id), None)
    if not player:
        raise HTTPException(status_code=403, detail="Not a member of this room")

    return {"messages": game_state.turn.chat_messages}

# WebSocket endpoint
#
# The player_id in the URL is accepted for routing compatibility, but the
# caller's identity is taken from the signed ?token= query parameter. The
# URL player_id is ignored — a client that passes someone else's id gets
# authenticated as whoever their token says they are.
@app.websocket("/ws/{room_code}/{player_id}")
async def websocket_endpoint(websocket: WebSocket, room_code: str, player_id: str):
    token = websocket.query_params.get("token")
    identity = decode_player_token(token or "")
    if not identity:
        await websocket.accept()
        await websocket.close(code=4401)
        return
    player_id = identity.user_id  # ignore URL-supplied id

    await manager.connect(websocket, room_code)
    try:
        # Send current game state to newly connected player
        game_state = manager.get_game_state(room_code)
        if game_state:
            player = next((p for p in game_state.players if p.id == player_id), None)
            if player:
                await websocket.send_text(json.dumps({
                    "type": "game_state",
                    "state": {
                        "status": game_state.status,
                        "phase": game_state.turn.phase,
                        "regent_seat": game_state.turn.regent_seat,
                        "nominee_seat": game_state.turn.nominee_seat,
                        "tracks": game_state.tracks.model_dump(),
                        "crisis": game_state.tracks.crisis,
                        "your_role": player.role if player.role else None,
                        "players": [{"id": p.id, "name": p.name, "seat": p.seat, "alive": p.alive} for p in game_state.players]
                    }
                }))

        while True:
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
            except Exception:
                continue

            if not isinstance(message, dict):
                continue

            # Handle different message types
            msg_type = message.get("type")
            if msg_type == "nominate":
                pass  # handled via REST /action
            elif msg_type == "vote":
                pass  # handled via REST /action
            elif msg_type == "chat":
                # Chat goes through the authenticated REST endpoint. Drop
                # anything received here so it can't be used to spoof as
                # another player over the WS.
                pass

    except WebSocketDisconnect:
        manager.disconnect(websocket, room_code)
        # Mark player as disconnected
        game_state = manager.get_game_state(room_code)
        if game_state:
            for player in game_state.players:
                if player.id == player_id:
                    player.connected = False
                    break


@app.websocket("/ws/audio/{room_code}/{player_id}")
async def audio_websocket_endpoint(websocket: WebSocket, room_code: str, player_id: str):
    """Relays PCM audio chunks between players for the entire game.

    Authentication is via the signed ?token= query parameter. Anyone who
    knew a bare user id previously could open this WS and eavesdrop on the
    entire voice channel — that is fixed here.
    """
    token = websocket.query_params.get("token")
    identity = decode_player_token(token or "")
    if not identity:
        await websocket.accept()
        await websocket.close(code=4401)
        return
    player_id = identity.user_id  # authoritative id

    game_state = manager.get_game_state(room_code)
    if not game_state:
        await websocket.accept()
        await websocket.close(code=4404)
        return
    player = next((p for p in game_state.players if p.id == player_id), None)
    if not player:
        await websocket.accept()
        await websocket.close(code=4403)
        return

    await audio_relay.connect(room_code, player_id, websocket)
    try:
        while True:
            msg = await websocket.receive()
            if "bytes" in msg and msg["bytes"] is not None:
                data: bytes = msg["bytes"]
                if len(data) < 3:
                    continue

                current_state = manager.get_game_state(room_code)
                if not current_state or current_state.status != "in_progress":
                    continue
                current_player = next(
                    (p for p in current_state.players if p.id == player_id),
                    None,
                )
                if not current_player or not current_player.alive:
                    continue

                sample_rate_bytes = data[:2]
                pcm = data[2:]
                header = bytes([current_player.seat, 0]) + sample_rate_bytes
                await audio_relay.relay(room_code, player_id, header + pcm)
            elif msg.get("type") == "websocket.disconnect":
                break
    except WebSocketDisconnect:
        pass
    finally:
        audio_relay.disconnect(room_code, player_id)


# Include router
app.include_router(api_router)

# CORS — strict allowlist. No wildcard, no default. If CORS_ORIGINS is not
# set, the server refuses to boot: silently accepting `*` with credentials
# would re-open the vulnerability this patch is meant to close.
_cors_origins_env = os.environ.get("CORS_ORIGINS")
if not _cors_origins_env:
    raise RuntimeError(
        "CORS_ORIGINS is not set. Export a comma-separated list of allowed "
        "origins (e.g. 'https://darkoath.net') before starting the backend."
    )
_cors_allowed = [o.strip() for o in _cors_origins_env.split(",") if o.strip()]
if not _cors_allowed or "*" in _cors_allowed:
    raise RuntimeError(
        "CORS_ORIGINS must be a concrete list of https://… origins, not '*'."
    )
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=_cors_allowed,
    allow_methods=["*"],
    allow_headers=["Authorization", "Content-Type"],
)

# Rate limiter wiring — exposes the limiter to route decorators and
# registers a clean 429 handler.
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

_prune_task: Optional[asyncio.Task] = None
_ticker_task: Optional[asyncio.Task] = None


async def _prune_loop():
    """Background task: periodically drop idle rooms from RAM."""
    while True:
        try:
            await asyncio.sleep(600)  # every 10 min
            pruned = manager.prune_idle_rooms()
            if pruned:
                logger.info("Pruned %d idle room(s)", pruned)
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.warning("prune_loop error: %s", e)


@app.on_event("startup")
async def _start_prune_task():
    global _prune_task, _ticker_task
    _prune_task = asyncio.create_task(_prune_loop())
    _ticker_task = asyncio.create_task(ticker_loop())


@app.on_event("shutdown")
async def shutdown_db_client():
    for task in (_prune_task, _ticker_task):
        if task is not None:
            task.cancel()
            try:
                await task
            except (asyncio.CancelledError, Exception):
                pass
    client.close()
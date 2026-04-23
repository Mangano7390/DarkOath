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

# Connection manager for WebSocket
class WebSocketManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}
        self.game_states: Dict[str, GameState] = {}
        # Last-activity timestamp per room, used to prune idle rooms from RAM.
        self.last_activity: Dict[str, float] = {}

    def touch_room(self, room_code: str) -> None:
        """Mark a room as active. Called on every authenticated action."""
        self.last_activity[room_code] = time.time()

    def prune_idle_rooms(self) -> int:
        """Drop rooms with no activity for longer than ROOM_IDLE_TTL_SECONDS.

        Keeps the in-memory state from growing without bound when players
        abandon rooms and never trigger a clean tear-down.
        """
        now = time.time()
        stale = [
            code for code, ts in self.last_activity.items()
            if now - ts > ROOM_IDLE_TTL_SECONDS
        ]
        for code in stale:
            self.game_states.pop(code, None)
            self.active_connections.pop(code, None)
            self.last_activity.pop(code, None)
        return len(stale)

    async def connect(self, websocket: WebSocket, room_code: str):
        await websocket.accept()
        if room_code not in self.active_connections:
            self.active_connections[room_code] = []
        self.active_connections[room_code].append(websocket)

    def disconnect(self, websocket: WebSocket, room_code: str):
        if room_code in self.active_connections:
            self.active_connections[room_code].remove(websocket)

    async def broadcast_to_room(self, room_code: str, message: dict):
        if room_code in self.active_connections:
            for connection in self.active_connections[room_code]:
                try:
                    await connection.send_text(json.dumps(message))
                except:
                    pass

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
        self.last_activity[room_code] = time.time()
        return game_state

    def get_game_state(self, room_code: str) -> Optional[GameState]:
        return self.game_states.get(room_code)

    def add_player(self, room_code: str, player_id: str, player_name: str) -> tuple[bool, str]:
        game_state = self.get_game_state(room_code)
        if not game_state:
            return False, "room_not_found"

        # Allow reconnection by id even if room is full / name matches the caller
        for p in game_state.players:
            if p.id == player_id:
                p.connected = True
                return True, "ok"

        if len(game_state.players) >= 10:
            return False, "room_full"

        # Reject duplicate pseudos (case-insensitive, trimmed)
        normalized = (player_name or "").strip().lower()
        if any((p.name or "").strip().lower() == normalized for p in game_state.players):
            return False, "name_taken"

        seat = len(game_state.players) + 1
        player = Player(id=player_id, name=player_name, seat=seat)
        game_state.players.append(player)
        return True, "ok"

    def start_game(self, room_code: str) -> bool:
        game_state = self.get_game_state(room_code)
        if not game_state or len(game_state.players) < 5:
            return False
        
        player_count = len(game_state.players)
        
        # Assign roles based on player count according to the rules
        if player_count == 5:
            roles = [Role.LOYAL, Role.LOYAL, Role.LOYAL, Role.CONJURE, Role.USURPATEUR]
        elif player_count == 6:
            roles = [Role.LOYAL, Role.LOYAL, Role.LOYAL, Role.LOYAL, Role.CONJURE, Role.USURPATEUR]
        elif player_count == 7:
            roles = [Role.LOYAL, Role.LOYAL, Role.LOYAL, Role.LOYAL, Role.CONJURE, Role.CONJURE, Role.USURPATEUR]
        elif player_count == 8:
            roles = [Role.LOYAL, Role.LOYAL, Role.LOYAL, Role.LOYAL, Role.LOYAL, Role.CONJURE, Role.CONJURE, Role.USURPATEUR]
        elif player_count == 9:
            roles = [Role.LOYAL, Role.LOYAL, Role.LOYAL, Role.LOYAL, Role.LOYAL, Role.CONJURE, Role.CONJURE, Role.CONJURE, Role.USURPATEUR]
        elif player_count == 10:
            roles = [Role.LOYAL, Role.LOYAL, Role.LOYAL, Role.LOYAL, Role.LOYAL, Role.LOYAL, Role.CONJURE, Role.CONJURE, Role.CONJURE, Role.USURPATEUR]
        else:
            return False
        
        # Shuffle roles randomly
        random.shuffle(roles)
        
        # Assign roles to players
        for i, player in enumerate(game_state.players[:player_count]):
            player.role = roles[i]

        # Randomize starting regent (seat). Previously always seat 1 = room creator.
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
        game_state.version += 1
        return True

    def check_win_conditions(self, game_state: GameState) -> Optional[str]:
        # Loyaux win: 5 loyal decrees or Usurpateur executed
        if game_state.tracks.loyal >= 5:
            game_state.winner_reason = "5_loyal"
            return "LOYAUX"

        # Check if Usurpateur was executed
        usurpateur_alive = any(p.role == Role.USURPATEUR and p.alive for p in game_state.players)
        if not usurpateur_alive:
            game_state.winner_reason = "tyran_executed"
            return "LOYAUX"

        # Conjures win: 6 conjure decrees
        if game_state.tracks.conjure >= 6:
            game_state.winner_reason = "6_conjure"
            return "CONJURES"

        # Conjures win: Usurpateur elected Chambellan after 3 conjure decrees
        if game_state.tracks.conjure >= 3:
            # This will be checked during nomination phase
            pass

        return None

    def _next_regent_seat(self, game_state: GameState, current_seat: int) -> int:
        """Rotate to the next alive regent, skipping disgraced and marked players."""
        alive_seats = sorted([p.seat for p in game_state.players if p.alive])
        if current_seat not in alive_seats:
            return alive_seats[0] if alive_seats else current_seat
        forbidden = set()
        if game_state.turn.disgraced_player_seat:
            forbidden.add(game_state.turn.disgraced_player_seat)
        if game_state.turn.marked_player_seat:
            forbidden.add(game_state.turn.marked_player_seat)
        idx = alive_seats.index(current_seat)
        n = len(alive_seats)
        for _ in range(n):
            idx = (idx + 1) % n
            candidate = alive_seats[idx]
            if candidate not in forbidden:
                return candidate
        # All forbidden (edge case) — just return next
        return alive_seats[(alive_seats.index(current_seat) + 1) % n]

    def _advance_to_next_nomination(self, game_state: GameState):
        """Rotate regent and enter NOMINATION for the next turn."""
        current_seat = game_state.turn.regent_seat
        next_regent_seat = self._next_regent_seat(game_state, current_seat)

        game_state.turn.regent_seat = next_regent_seat
        game_state.turn.phase = Phase.NOMINATION
        game_state.turn.prev_government = {
            "regent": current_seat,
            "chambellan": game_state.turn.nominee_seat
        }
        game_state.turn.nominee_seat = None
        game_state.turn.votes = {}
        game_state.turn.turn_number += 1
        # Clear transient power state so the next turn starts clean
        game_state.turn.active_power = None
        game_state.turn.power_result = None
        game_state.turn.last_execution_seat = None

    def _enter_defiance_phase(self, game_state: GameState):
        """Open the Piste de Défiance vote."""
        import time
        game_state.turn.phase = Phase.DEFIANCE
        game_state.turn.defiance_votes = {}
        game_state.turn.defiance_start_time = time.time()

    def _resolve_defiance(self, game_state: GameState):
        """Tally defiance votes, update counts, set marked player, advance to NOMINATION."""
        # Clear previous turn's mark (its 1-turn effect has been served)
        game_state.turn.marked_player_seat = None

        # Tally non-null votes into cumulative counts
        for target_seat in game_state.turn.defiance_votes.values():
            if target_seat is None:
                continue
            game_state.turn.defiance_counts[target_seat] = (
                game_state.turn.defiance_counts.get(target_seat, 0) + 1
            )

        # Find players at/over threshold; pick the highest count (ties: lowest seat)
        over = [
            (seat, count) for seat, count in game_state.turn.defiance_counts.items()
            if count >= DEFIANCE_MARK_THRESHOLD
        ]
        if over:
            over.sort(key=lambda x: (-x[1], x[0]))
            marked_seat = over[0][0]
            game_state.turn.marked_player_seat = marked_seat
            # Reset that player's counter only
            game_state.turn.defiance_counts[marked_seat] = 0

        # Clear round-local votes and timer
        game_state.turn.defiance_votes = {}
        game_state.turn.defiance_start_time = None

        # Advance to next turn's NOMINATION
        self._advance_to_next_nomination(game_state)

    async def advance_after_conseil(self, game_state: GameState):
        """Advance game to next phase after Conseil du Royaume expires"""
        # Reset council phase data
        game_state.turn.conseil_royaume_timer = None
        game_state.turn.conseil_royaume_start_time = None
        game_state.turn.speaking_players = []

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

        # Pas de pouvoir → Piste de Défiance (dès le tour 2) ou Nomination directe
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

    async def check_defiance_timeout(self):
        """Auto-resolve expired DEFIANCE phases."""
        import time
        current_time = time.time()
        for room_code, game_state in list(self.game_states.items()):
            if (game_state.turn.phase == Phase.DEFIANCE and
                    game_state.turn.defiance_start_time and
                    (current_time - game_state.turn.defiance_start_time) >= DEFIANCE_DURATION_SECONDS):
                self._resolve_defiance(game_state)
                game_state.version += 1
                await self.broadcast_to_room(room_code, {
                    "type": "game_update",
                    "data": "defiance_timeout",
                    "version": game_state.version
                })

    async def check_conseil_royaume_timeout(self):
        """Check all games for expired Conseil du Royaume phases"""
        import time
        current_time = time.time()
        
        for room_code, game_state in self.game_states.items():
            if (game_state.turn.phase == Phase.CONSEIL_ROYAUME and
                game_state.turn.conseil_royaume_start_time and
                (current_time - game_state.turn.conseil_royaume_start_time) >= 60):
                
                # Time's up! Advance to next phase
                await self.advance_after_conseil(game_state)
                game_state.version += 1
                
                await self.broadcast_to_room(room_code, {
                    "type": "game_update",
                    "data": "conseil_timeout",
                    "version": game_state.version
                })

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
        "players": [{"id": p.id, "name": p.name, "seat": p.seat, "connected": p.connected} for p in game_state.players]
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
            "room_full": "Room is full",
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

    chat_message = {
        "id": len(game_state.turn.chat_messages) + 1,
        "player_id": identity.user_id,
        "player_name": player.name,
        "message": message,
        "timestamp": datetime.now().isoformat(),
        "type": "player"
    }

    game_state.turn.chat_messages.append(chat_message)
    # Keep the chat buffer bounded in RAM (oldest messages roll off).
    if len(game_state.turn.chat_messages) > 500:
        game_state.turn.chat_messages = game_state.turn.chat_messages[-500:]

    await manager.broadcast_to_room(room_code, {
        "type": "chat_message",
        **chat_message
    })

    return {"success": True, "message": chat_message}


class ActionBody(BaseModel):
    action_type: str
    payload: Dict[str, Any] = {}


@api_router.post("/rooms/{room_code}/action")
async def handle_game_action(
    room_code: str,
    body: ActionBody,
    identity: PlayerIdentity = Depends(require_player),
):
    """Handle game actions like nomination, voting, legislative actions.

    The acting player is derived from the JWT — previously any client could
    act on behalf of anyone by passing an arbitrary player_id in the URL.
    """
    manager.touch_room(room_code)
    game_state = manager.get_game_state(room_code)
    if not game_state:
        raise HTTPException(status_code=404, detail="Room not found")

    player_id = identity.user_id
    action_type = body.action_type
    payload = body.payload or {}

    player = next((p for p in game_state.players if p.id == player_id), None)
    if not player:
        raise HTTPException(status_code=403, detail="Not a member of this room")
    
    try:
        if action_type == "NOMINATE":
            # Only regent can nominate during NOMINATION phase
            if game_state.turn.phase != Phase.NOMINATION:
                raise HTTPException(status_code=400, detail="Wrong phase for nomination")
            if player.seat != game_state.turn.regent_seat:
                raise HTTPException(status_code=400, detail="Only regent can nominate")
            
            nominee_seat = payload.get("nomineeSeat")
            if not nominee_seat:
                raise HTTPException(status_code=400, detail="Missing nominee seat")
            
            # Check if nominee is valid
            nominee = next((p for p in game_state.players if p.seat == nominee_seat), None)
            if not nominee or not nominee.alive:
                raise HTTPException(status_code=400, detail="Invalid nominee")
            
            # Check if nominee was in previous government
            if game_state.turn.prev_government:
                prev_gov = game_state.turn.prev_government
                if nominee_seat == prev_gov.get("regent") or nominee_seat == prev_gov.get("chambellan"):
                    raise HTTPException(status_code=400, detail="Nominee was in previous government")
            
            # Check if nominee is disgraced (cannot be nominated after "Colère du Peuple")
            if game_state.turn.disgraced_player_seat == nominee_seat:
                raise HTTPException(status_code=400, detail="Cannot nominate disgraced player")

            # Check if nominee is marked by Piste de Défiance
            if game_state.turn.marked_player_seat == nominee_seat:
                raise HTTPException(status_code=400, detail="Cannot nominate marked player")

            # Can't nominate self
            if nominee_seat == game_state.turn.regent_seat:
                raise HTTPException(status_code=400, detail="Cannot nominate self")
            
            # Update game state
            game_state.turn.nominee_seat = nominee_seat
            game_state.turn.phase = Phase.VOTE
            game_state.turn.votes = {}  # Reset votes
            game_state.version += 1
            
            # Broadcast update
            await manager.broadcast_to_room(room_code, {
                "type": "game_update",
                "phase": game_state.turn.phase,
                "nominee_seat": nominee_seat,
                "version": game_state.version
            })
            
        elif action_type == "VOTE":
            # Only non-government players can vote during VOTE phase
            if game_state.turn.phase != Phase.VOTE:
                raise HTTPException(status_code=400, detail="Wrong phase for voting")
            if not player.alive:
                raise HTTPException(status_code=400, detail="Dead players cannot vote")
            
            # Check if player is regent or nominee - they cannot vote
            if player.seat == game_state.turn.regent_seat:
                raise HTTPException(status_code=400, detail="Regent cannot vote")
            if player.seat == game_state.turn.nominee_seat:
                raise HTTPException(status_code=400, detail="Nominee cannot vote")
            
            vote = payload.get("vote")
            if vote not in ["oui", "non"]:
                raise HTTPException(status_code=400, detail="Invalid vote")
            
            # Record vote
            game_state.turn.votes[player_id] = vote
            
            # Check if all eligible players have voted (excluding regent and nominee)
            alive_players = [p for p in game_state.players if p.alive]
            eligible_voters = [p for p in alive_players if p.seat != game_state.turn.regent_seat and p.seat != game_state.turn.nominee_seat]
            if len(game_state.turn.votes) >= len(eligible_voters):
                # Count votes
                yes_votes = sum(1 for v in game_state.turn.votes.values() if v == "oui")
                no_votes = len(game_state.turn.votes) - yes_votes
                
                if yes_votes > no_votes:
                    # Government elected - move to legislative phase
                    game_state.turn.phase = Phase.LEGIS_REGENT
                    game_state.tracks.crisis = 0  # Reset crisis on successful election
                    
                    # Rehabilitate disgraced player after successful election
                    game_state.turn.disgraced_player_seat = None
                    game_state.turn.peoples_anger_triggered = False
                    
                    # Draw 3 cards from deck for the regent to examine
                    if len(game_state.deck) >= 3:
                        game_state.turn.legislative_cards = game_state.deck[:3]
                        game_state.deck = game_state.deck[3:]
                        game_state.turn.deck_count = len(game_state.deck)
                    else:
                        # Handle edge case where deck is almost empty
                        game_state.turn.legislative_cards = game_state.deck.copy()
                        game_state.deck = []
                        game_state.turn.deck_count = 0
                    
                    # Set previous government
                    game_state.turn.prev_government = {
                        "regent": game_state.turn.regent_seat,
                        "chambellan": game_state.turn.nominee_seat
                    }
                    
                    # Clear votes but keep nominee_seat for legislative phase
                    game_state.turn.votes = {}
                else:
                    # Government rejected - crisis increases
                    game_state.tracks.crisis += 1
                    
                    if game_state.tracks.crisis >= 3:
                        # COLÈRE DU PEUPLE - Enhanced crisis rule
                        # Auto-adopt top card
                        if len(game_state.deck) > 0:
                            top_card = game_state.deck.pop(0)
                            if top_card == DecreeType.LOYAL:
                                game_state.tracks.loyal += 1
                            else:
                                game_state.tracks.conjure += 1
                        
                        # Disgrace the current Seigneur (can't be Seigneur or Sénéchal next turn)
                        game_state.turn.disgraced_player_seat = game_state.turn.regent_seat
                        game_state.turn.peoples_anger_triggered = True
                        
                        # Reset crisis
                        game_state.tracks.crisis = 0
                    
                    # Move to next regent (skip disgraced and marked players)
                    current_seat = game_state.turn.regent_seat
                    next_regent_seat = manager._next_regent_seat(game_state, current_seat)

                    game_state.turn.regent_seat = next_regent_seat
                    game_state.turn.phase = Phase.NOMINATION

                    # Clear nominee and votes for rejected government
                    game_state.turn.nominee_seat = None
                    game_state.turn.votes = {}
                game_state.version += 1
                
                # Check win conditions
                winner = manager.check_win_conditions(game_state)
                if winner:
                    game_state.winner = winner
                    game_state.turn.phase = Phase.ENDGAME
                
                await manager.broadcast_to_room(room_code, {
                    "type": "vote_result",
                    "result": "elected" if yes_votes > no_votes else "rejected",
                    "yes_votes": yes_votes,
                    "no_votes": no_votes,
                    "new_phase": game_state.turn.phase,
                    "tracks": game_state.tracks.dict(),
                    "regent_seat": game_state.turn.regent_seat,
                    "winner": winner,
                    "version": game_state.version
                })
            else:
                # Just broadcast vote count update with eligible voters count
                alive_players = [p for p in game_state.players if p.alive]
                eligible_voters = [p for p in alive_players if p.seat != game_state.turn.regent_seat and p.seat != game_state.turn.nominee_seat]
                await manager.broadcast_to_room(room_code, {
                    "type": "vote_progress",
                    "votes_count": len(game_state.turn.votes),
                    "total_needed": len(eligible_voters)
                })
        
        elif action_type == "DISCARD":
            # Handle legislative card discard during LEGIS_REGENT or CONSEIL_ROYAUME phase
            if game_state.turn.phase == Phase.LEGIS_REGENT:
                # Only regent can discard during LEGIS_REGENT phase
                if player.seat != game_state.turn.regent_seat:
                    raise HTTPException(status_code=400, detail="Only regent can discard during this phase")
                
                card_index = payload.get("cardId")
                if card_index is None or card_index < 0 or card_index >= len(game_state.turn.legislative_cards):
                    raise HTTPException(status_code=400, detail="Invalid card index")
                
                # Discard the selected card
                discarded_card = game_state.turn.legislative_cards.pop(card_index)
                game_state.discard.append(discarded_card)
                game_state.turn.discard_count = len(game_state.discard)
                
                # Move to LEGIS_CHAMBELLAN phase (2 cards remain for chambellan)
                game_state.turn.phase = Phase.LEGIS_CHAMBELLAN
                game_state.version += 1
                
                await manager.broadcast_to_room(room_code, {
                    "type": "phase_change",
                    "new_phase": game_state.turn.phase,
                    "version": game_state.version
                })
                
            elif game_state.turn.phase == Phase.LEGIS_CHAMBELLAN:
                # Only chambellan can discard during LEGIS_CHAMBELLAN phase
                if player.seat != game_state.turn.nominee_seat:
                    raise HTTPException(status_code=400, detail="Only chambellan can discard during this phase") 
                
                card_index = payload.get("cardId")
                if card_index is None or card_index < 0 or card_index >= len(game_state.turn.legislative_cards):
                    raise HTTPException(status_code=400, detail="Invalid card index")
                
                # The chosen card is adopted, the other is discarded
                adopted_card = game_state.turn.legislative_cards.pop(card_index)
                discarded_card = game_state.turn.legislative_cards.pop(0)  # Remaining card is discarded
                
                # Update tracks based on adopted card
                if adopted_card == DecreeType.LOYAL:
                    game_state.tracks.loyal += 1
                else:
                    game_state.tracks.conjure += 1
                
                # Add discarded card to discard pile
                game_state.discard.append(discarded_card)
                game_state.turn.discard_count = len(game_state.discard)
                
                # Clear legislative cards
                game_state.turn.legislative_cards = []
                
                # Check for powers and win conditions
                winner = manager.check_win_conditions(game_state)
                if winner:
                    game_state.winner = winner
                    game_state.turn.phase = Phase.ENDGAME
                else:
                    # After a decree is revealed, trigger Conseil du Royaume phase
                    import time
                    game_state.turn.phase = Phase.CONSEIL_ROYAUME
                    game_state.turn.conseil_royaume_timer = 60  # 60 seconds (1 min)
                    game_state.turn.conseil_royaume_start_time = time.time()
                    game_state.turn.speaking_players = []
                
                game_state.turn.nominee_seat = None
                game_state.turn.votes = {}
                game_state.version += 1
                
                await manager.broadcast_to_room(room_code, {
                    "type": "legislation_enacted",
                    "adopted_card": adopted_card,
                    "new_tracks": game_state.tracks.dict(),
                    "new_phase": game_state.turn.phase,
                    "regent_seat": game_state.turn.regent_seat,
                    "winner": winner,
                    "version": game_state.version
                })
            else:
                raise HTTPException(status_code=400, detail="Wrong phase for card discard")
        
        elif action_type == "DEFIANCE_VOTE":
            # Cast a suspicion vote during the DEFIANCE phase (or pass).
            # Graceful race-handling: if the DEFIANCE phase has already auto-resolved
            # (timeout elapsed, or every other player just voted) between the user
            # opening the panel and clicking, we treat the vote as a no-op instead of
            # raising. This avoids the "Wrong phase for defiance vote" error that
            # popped up when a player clicked "Passer" just after resolution.
            if game_state.turn.phase != Phase.DEFIANCE:
                return {"success": True, "stale": True, "version": game_state.version}
            if not player.alive:
                raise HTTPException(status_code=400, detail="Dead players cannot vote")

            raw_target = payload.get("targetSeat")
            target_seat: Optional[int] = None
            if raw_target is not None:
                try:
                    target_seat = int(raw_target)
                except (TypeError, ValueError):
                    raise HTTPException(status_code=400, detail="Invalid target seat")
                target_player = next((p for p in game_state.players if p.seat == target_seat), None)
                if not target_player or not target_player.alive:
                    raise HTTPException(status_code=400, detail="Invalid target")
                if target_seat == player.seat:
                    raise HTTPException(status_code=400, detail="Cannot target yourself")

            # Record vote (None = passed). Overwrites if player re-votes before resolution.
            game_state.turn.defiance_votes[player_id] = target_seat

            # If every alive player has voted, resolve immediately
            alive_ids = {p.id for p in game_state.players if p.alive}
            if alive_ids.issubset(set(game_state.turn.defiance_votes.keys())):
                manager._resolve_defiance(game_state)

            game_state.version += 1
            await manager.broadcast_to_room(room_code, {
                "type": "game_update",
                "data": "defiance_vote",
                "phase": game_state.turn.phase,
                "version": game_state.version
            })

        elif action_type == "INVESTIGATE":
            # Pouvoir Investigation — seul le Roi agit pendant POWER / active_power == INVESTIGATE.
            if game_state.turn.phase != Phase.POWER or game_state.turn.active_power != "INVESTIGATE":
                raise HTTPException(status_code=400, detail="Wrong phase for investigation")
            if player.seat != game_state.turn.regent_seat:
                raise HTTPException(status_code=400, detail="Only the King can investigate")
            if game_state.turn.power_result is not None:
                raise HTTPException(status_code=400, detail="Investigation already performed this turn")

            raw_target = payload.get("targetSeat")
            try:
                target_seat = int(raw_target)
            except (TypeError, ValueError):
                raise HTTPException(status_code=400, detail="Invalid target seat")
            target = next((p for p in game_state.players if p.seat == target_seat), None)
            if not target or not target.alive:
                raise HTTPException(status_code=400, detail="Invalid target")
            if target_seat == player.seat:
                raise HTTPException(status_code=400, detail="Cannot investigate yourself")

            # Camp révélé : Fidèle vs Traître (Tyran se camoufle dans "Traître").
            camp = "Fidèle" if target.role == Role.LOYAL else "Traître"
            game_state.turn.power_result = {
                "target_seat": target_seat,
                "target_name": target.name,
                "camp": camp,
            }
            game_state.powers["investigation_used"] = True
            game_state.version += 1

            await manager.broadcast_to_room(room_code, {
                "type": "game_update",
                "data": "investigation_done",
                "version": game_state.version,
            })

        elif action_type == "EXECUTE":
            # Pouvoir Exécution — seul le Roi agit pendant POWER / active_power == EXECUTE.
            if game_state.turn.phase != Phase.POWER or game_state.turn.active_power != "EXECUTE":
                raise HTTPException(status_code=400, detail="Wrong phase for execution")
            if player.seat != game_state.turn.regent_seat:
                raise HTTPException(status_code=400, detail="Only the King can execute")

            raw_target = payload.get("targetSeat")
            try:
                target_seat = int(raw_target)
            except (TypeError, ValueError):
                raise HTTPException(status_code=400, detail="Invalid target seat")
            target = next((p for p in game_state.players if p.seat == target_seat), None)
            if not target or not target.alive:
                raise HTTPException(status_code=400, detail="Invalid target")
            if target_seat == player.seat:
                raise HTTPException(status_code=400, detail="Cannot execute yourself")

            # Kill target
            target.alive = False
            game_state.powers["execution_used"] = True
            game_state.powers["executed_once"] = True
            game_state.turn.last_execution_seat = target_seat

            # Victoire Fidèles si le Tyran est exécuté
            if target.role == Role.USURPATEUR:
                game_state.winner = "FIDELES"
                game_state.winner_reason = "tyran_executed"
                game_state.turn.phase = Phase.ENDGAME
                game_state.turn.active_power = None
                game_state.turn.power_result = None
            else:
                # Si le mort était Roi du prochain tour, _flow → _next_regent_seat sautera
                # automatiquement les morts. Continue le flow normal.
                manager._advance_after_power(game_state)

            game_state.version += 1
            await manager.broadcast_to_room(room_code, {
                "type": "game_update",
                "data": "execution_done",
                "executed_seat": target_seat,
                "winner": game_state.winner,
                "version": game_state.version,
            })

        elif action_type == "ACK_POWER":
            # Le Roi ferme le résultat d'investigation et on enchaîne la phase suivante.
            if game_state.turn.phase != Phase.POWER:
                raise HTTPException(status_code=400, detail="Wrong phase")
            if player.seat != game_state.turn.regent_seat:
                raise HTTPException(status_code=400, detail="Only the King can acknowledge")
            if game_state.turn.active_power != "INVESTIGATE" or game_state.turn.power_result is None:
                raise HTTPException(status_code=400, detail="No power result to acknowledge")

            manager._advance_after_power(game_state)
            game_state.version += 1
            await manager.broadcast_to_room(room_code, {
                "type": "game_update",
                "data": "power_acknowledged",
                "version": game_state.version,
            })

        elif action_type == "SPEAK_TOGGLE":
            # Voice is available for the whole game. Only require that the
            # game is in progress and the player is alive.
            if game_state.status != "in_progress":
                raise HTTPException(status_code=400, detail="Game not in progress")
            if not player.alive:
                raise HTTPException(status_code=400, detail="Dead players cannot speak")

            if player.seat in game_state.turn.speaking_players:
                game_state.turn.speaking_players.remove(player.seat)
            else:
                game_state.turn.speaking_players.append(player.seat)

            game_state.version += 1
            await manager.broadcast_to_room(room_code, {
                "type": "game_update",
                "data": "speaking_update",
                "version": game_state.version
            })
        
        else:
            raise HTTPException(status_code=400, detail="Unknown action type")
            
        return {"success": True, "version": game_state.version}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Action failed: {str(e)}")

@api_router.get("/rooms/{room_code}/game_state")
async def get_game_state(
    room_code: str,
    identity: PlayerIdentity = Depends(require_player),
):
    """Get current game state for a player.

    CRITICAL: the caller is identified by JWT, never by a client-supplied
    player_id. Before this fix, a client could pass ?player_id=X in the
    URL and read X's secret role (your_role / teammates / power_result).
    """
    manager.touch_room(room_code)
    if room_code not in manager.game_states:
        raise HTTPException(status_code=404, detail="Room not found")

    player_id = identity.user_id
    game_state = manager.game_states[room_code]
    
    # Check if Conseil du Royaume has expired and auto-advance if needed
    if game_state.turn.phase == Phase.CONSEIL_ROYAUME and game_state.turn.conseil_royaume_start_time:
        import time
        current_time = time.time()
        if (current_time - game_state.turn.conseil_royaume_start_time) >= 60:
            # Time's up! Advance to next phase
            await manager.advance_after_conseil(game_state)
            game_state.version += 1

            # Broadcast the update
            await manager.broadcast_to_room(room_code, {
                "type": "game_update",
                "data": "conseil_timeout",
                "version": game_state.version
            })

    # Check if DEFIANCE phase has expired and auto-resolve
    elif game_state.turn.phase == Phase.DEFIANCE and game_state.turn.defiance_start_time:
        import time
        current_time = time.time()
        if (current_time - game_state.turn.defiance_start_time) >= DEFIANCE_DURATION_SECONDS:
            manager._resolve_defiance(game_state)
            game_state.version += 1
            await manager.broadcast_to_room(room_code, {
                "type": "game_update",
                "data": "defiance_timeout",
                "version": game_state.version
            })
    
    player = next((p for p in game_state.players if p.id == player_id), None)
    if not player:
        raise HTTPException(status_code=403, detail="Not a member of this room")

    # Determine if player can see legislative cards
    legislative_cards = []
    if game_state.turn.phase == Phase.LEGIS_REGENT and player.seat == game_state.turn.regent_seat:
        # Regent can see the cards during LEGIS_REGENT phase
        legislative_cards = game_state.turn.legislative_cards
    elif game_state.turn.phase == Phase.LEGIS_CHAMBELLAN and player.seat == game_state.turn.nominee_seat:
        # Chambellan can see the cards during LEGIS_CHAMBELLAN phase
        legislative_cards = game_state.turn.legislative_cards
    
    # Compute teammates (secret info visible to this player only)
    #
    # Règle Dark Oath :
    # - Les Conjurés (traîtres) connaissent l'identité du Tyran ET des autres Conjurés.
    # - Le Tyran (Usurpateur) ne connaît l'identité de PERSONNE (ni Conjurés, ni Fidèles).
    # - Les Fidèles ne connaissent l'identité de personne.
    teammates = []
    if player.role == Role.CONJURE:
        # Les Conjurés voient les autres Conjurés ET le Tyran.
        teammates = [
            {"seat": p.seat, "name": p.name, "role": p.role}
            for p in game_state.players
            if p.id != player.id and p.role in (Role.CONJURE, Role.USURPATEUR)
        ]
    # Le Tyran et les Fidèles n'ont aucun allié révélé au début de la partie.

    return {
        "status": game_state.status,
        "phase": game_state.turn.phase,
        "regent_seat": game_state.turn.regent_seat,
        "nominee_seat": game_state.turn.nominee_seat,
        "prev_government": game_state.turn.prev_government,
        "votes": game_state.turn.votes,
        "tracks": game_state.tracks.dict(),
        "crisis": game_state.tracks.crisis,
        "your_role": player.role if player.role else None,
        "teammates": teammates,
        "players": [{"id": p.id, "name": p.name, "seat": p.seat, "alive": p.alive, "connected": p.connected} for p in game_state.players],
        "winner": game_state.winner,
        "winner_reason": game_state.winner_reason,
        "version": game_state.version,
        "legislative_cards": legislative_cards,
        "disgraced_player_seat": game_state.turn.disgraced_player_seat,
        "peoples_anger_triggered": game_state.turn.peoples_anger_triggered,
        "conseil_royaume_timer": game_state.turn.conseil_royaume_timer,
        "conseil_royaume_start_time": game_state.turn.conseil_royaume_start_time,
        "speaking_players": game_state.turn.speaking_players,
        # Piste de Défiance
        "turn_number": game_state.turn.turn_number,
        "defiance_counts": game_state.turn.defiance_counts,
        "defiance_voted_ids": list(game_state.turn.defiance_votes.keys()),
        "defiance_my_target": game_state.turn.defiance_votes.get(player_id) if player_id in game_state.turn.defiance_votes else None,
        "defiance_has_voted": player_id in game_state.turn.defiance_votes,
        "marked_player_seat": game_state.turn.marked_player_seat,
        "defiance_start_time": game_state.turn.defiance_start_time,
        "defiance_duration": DEFIANCE_DURATION_SECONDS,
        "defiance_threshold": DEFIANCE_MARK_THRESHOLD,
        # Pouvoir du Roi — active_power visible à tous, power_result uniquement au Roi
        "active_power": game_state.turn.active_power,
        "power_result": (
            game_state.turn.power_result
            if game_state.turn.active_power == "INVESTIGATE"
               and player.seat == game_state.turn.regent_seat
            else None
        ),
        "last_execution_seat": game_state.turn.last_execution_seat,
        "powers": game_state.powers,
    }
@api_router.post("/rooms/{room_code}/start")
async def start_game(
    room_code: str,
    identity: PlayerIdentity = Depends(require_player),
):
    manager.touch_room(room_code)
    game_state = manager.get_game_state(room_code)
    if not game_state:
        raise HTTPException(status_code=404, detail="Room not found")
    # Only an actual room member can start. Previously /start was unauthenticated
    # and a random attacker could force-start any room by knowing the 6-letter code.
    if not any(p.id == identity.user_id for p in game_state.players):
        raise HTTPException(status_code=403, detail="Not a member of this room")
    success = manager.start_game(room_code)
    if not success:
        raise HTTPException(status_code=400, detail="Cannot start game")

    game_state = manager.get_game_state(room_code)

    # Track games played
    try:
        admin_stats.increment("games_played")
    except Exception as e:
        logging.warning(f"Could not increment games_played stat: {e}")

    # Send roles to each player privately and game start to all
    for player in game_state.players:
        await manager.broadcast_to_room(room_code, {
            "type": "game_started",
            "phase": game_state.turn.phase,
            "regent_seat": game_state.turn.regent_seat,
            "tracks": game_state.tracks.dict(),
            "version": game_state.version
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
                        "tracks": game_state.tracks.dict(),
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
    global _prune_task
    _prune_task = asyncio.create_task(_prune_loop())


@app.on_event("shutdown")
async def shutdown_db_client():
    global _prune_task
    if _prune_task is not None:
        _prune_task.cancel()
        try:
            await _prune_task
        except (asyncio.CancelledError, Exception):
            pass
    client.close()
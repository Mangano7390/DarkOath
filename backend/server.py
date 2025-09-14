from fastapi import FastAPI, APIRouter, WebSocket, WebSocketDisconnect, HTTPException
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

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

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
    POWER = "POWER"
    ENDGAME = "ENDGAME"

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

class GameState(BaseModel):
    room_code: str
    status: str = "lobby"
    players: List[Player] = []
    tracks: GameTracks = GameTracks()
    turn: TurnState = TurnState()
    powers: Dict[str, bool] = {"investigation_unlocked": False, "execution_unlocked": False, "executed_once": False}
    winner: Optional[str] = None
    version: int = 0
    deck: List[DecreeType] = []
    discard: List[DecreeType] = []

# Connection manager for WebSocket
class WebSocketManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}
        self.game_states: Dict[str, GameState] = {}

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
        return game_state

    def get_game_state(self, room_code: str) -> Optional[GameState]:
        return self.game_states.get(room_code)

    def add_player(self, room_code: str, player_id: str, player_name: str) -> bool:
        game_state = self.get_game_state(room_code)
        if not game_state or len(game_state.players) >= 5:
            return False
        
        # Check if player already exists
        for p in game_state.players:
            if p.id == player_id:
                p.connected = True
                return True
        
        # Add new player
        seat = len(game_state.players) + 1
        player = Player(id=player_id, name=player_name, seat=seat)
        game_state.players.append(player)
        return True

    def start_game(self, room_code: str) -> bool:
        game_state = self.get_game_state(room_code)
        if not game_state or len(game_state.players) < 5:
            return False
        
        # Assign roles for 5 players: 3 LOYAL, 1 CONJURE, 1 USURPATEUR
        roles = [Role.LOYAL, Role.LOYAL, Role.LOYAL, Role.CONJURE, Role.USURPATEUR]
        random.shuffle(roles)
        
        for i, player in enumerate(game_state.players):
            player.role = roles[i]
        
        game_state.status = "in_progress"
        game_state.turn.phase = Phase.NOMINATION
        game_state.version += 1
        return True

    def check_win_conditions(self, game_state: GameState) -> Optional[str]:
        # Loyaux win: 5 loyal decrees or Usurpateur executed
        if game_state.tracks.loyal >= 5:
            return "LOYAUX"
        
        # Check if Usurpateur was executed
        usurpateur_alive = any(p.role == Role.USURPATEUR and p.alive for p in game_state.players)
        if not usurpateur_alive:
            return "LOYAUX"
        
        # Conjures win: 6 conjure decrees
        if game_state.tracks.conjure >= 6:
            return "CONJURES"
        
        # Conjures win: Usurpateur elected Chambellan after 3 conjure decrees
        if game_state.tracks.conjure >= 3:
            # This will be checked during nomination phase
            pass
        
        return None

manager = WebSocketManager()

# API Routes
@api_router.post("/auth/anonymous")
async def create_anonymous_user(name: str):
    user_id = str(uuid.uuid4())
    return {"userId": user_id, "token": user_id, "name": name}

@api_router.post("/rooms")
async def create_room():
    room_code = ''.join(random.choices('ABCDEFGHIJKLMNOPQRSTUVWXYZ', k=6))
    game_state = manager.create_room(room_code)
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
async def join_room(room_code: str, player_id: str, player_name: str):
    success = manager.add_player(room_code, player_id, player_name)
    if not success:
        raise HTTPException(status_code=400, detail="Cannot join room")
    
    game_state = manager.get_game_state(room_code)
    await manager.broadcast_to_room(room_code, {
        "type": "player_joined",
        "players": [{"id": p.id, "name": p.name, "seat": p.seat, "connected": p.connected} for p in game_state.players]
    })
    
    return {"success": True}

@api_router.post("/rooms/{room_code}/start")
async def start_game(room_code: str):
    success = manager.start_game(room_code)
    if not success:
        raise HTTPException(status_code=400, detail="Cannot start game")
    
    game_state = manager.get_game_state(room_code)
    
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

# WebSocket endpoint
@app.websocket("/ws/{room_code}/{player_id}")
async def websocket_endpoint(websocket: WebSocket, room_code: str, player_id: str):
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
            message = json.loads(data)
            
            # Handle different message types
            if message["type"] == "nominate":
                # Handle nomination logic
                pass
            elif message["type"] == "vote":
                # Handle voting logic
                pass
            elif message["type"] == "chat":
                # Broadcast chat message
                await manager.broadcast_to_room(room_code, {
                    "type": "chat_message",
                    "player_id": player_id,
                    "message": message["content"],
                    "timestamp": datetime.now(timezone.utc).isoformat()
                })
                
    except WebSocketDisconnect:
        manager.disconnect(websocket, room_code)
        # Mark player as disconnected
        game_state = manager.get_game_state(room_code)
        if game_state:
            for player in game_state.players:
                if player.id == player_id:
                    player.connected = False
                    break

# Include router
app.include_router(api_router)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
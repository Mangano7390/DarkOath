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
    legislative_cards: List[DecreeType] = []  # Cards currently being considered by regent/chambellan

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
        if not game_state:
            return False
        
        # Check if player already exists first (allow reconnection even if room is full)
        for p in game_state.players:
            if p.id == player_id:
                p.connected = True
                return True
        
        # Only check room capacity for new players - now supports up to 10 players
        if len(game_state.players) >= 10:
            return False
        
        # Add new player
        seat = len(game_state.players) + 1
        player = Player(id=player_id, name=player_name, seat=seat)
        game_state.players.append(player)
        return True

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
@api_router.get("/")
async def root():
    return {"message": "Secretus Regnum API"}

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

@api_router.post("/rooms/{room_code}/chat")
async def send_chat_message(room_code: str, player_id: str, message: str):
    """Send a chat message to all players in the room"""
    game_state = manager.get_game_state(room_code)
    if not game_state:
        raise HTTPException(status_code=404, detail="Room not found")
    
    # Find the player
    player = next((p for p in game_state.players if p.id == player_id), None)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    
    # Broadcast chat message
    await manager.broadcast_to_room(room_code, {
        "type": "chat_message",
        "player_id": player_id,
        "player_name": player.name,
        "message": message,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
    
    return {"success": True}

@api_router.post("/rooms/{room_code}/action")
async def handle_game_action(room_code: str, player_id: str, action_type: str, payload: dict = {}):
    """Handle game actions like nomination, voting, legislative actions"""
    game_state = manager.get_game_state(room_code)
    if not game_state:
        raise HTTPException(status_code=404, detail="Room not found")
    
    # Find the acting player
    player = next((p for p in game_state.players if p.id == player_id), None)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    
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
                        # Auto-adopt top card
                        if len(game_state.deck) > 0:
                            top_card = game_state.deck.pop(0)
                            if top_card == DecreeType.LOYAL:
                                game_state.tracks.loyal += 1
                            else:
                                game_state.tracks.conjure += 1
                        game_state.tracks.crisis = 0
                    
                    # Move to next regent
                    current_seat = game_state.turn.regent_seat
                    alive_seats = [p.seat for p in game_state.players if p.alive]
                    alive_seats.sort()
                    current_index = alive_seats.index(current_seat)
                    next_index = (current_index + 1) % len(alive_seats)
                    game_state.turn.regent_seat = alive_seats[next_index]
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
            # Handle legislative card discard during LEGIS_REGENT or LEGIS_CHAMBELLAN phase
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
                    # Check for executive powers based on conjure track
                    if game_state.tracks.conjure >= 2 and not game_state.powers.get("investigation_unlocked"):
                        game_state.powers["investigation_unlocked"] = True
                        game_state.turn.phase = Phase.POWER
                    elif game_state.tracks.conjure >= 4 and not game_state.powers.get("executed_once"):
                        game_state.powers["execution_unlocked"] = True  
                        game_state.turn.phase = Phase.POWER
                    else:
                        # Move to next regent and new nomination phase
                        current_seat = game_state.turn.regent_seat
                        alive_seats = [p.seat for p in game_state.players if p.alive]
                        alive_seats.sort()
                        current_index = alive_seats.index(current_seat)
                        next_index = (current_index + 1) % len(alive_seats)
                        game_state.turn.regent_seat = alive_seats[next_index]
                        game_state.turn.phase = Phase.NOMINATION
                
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
        
        else:
            raise HTTPException(status_code=400, detail="Unknown action type")
            
        return {"success": True, "version": game_state.version}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Action failed: {str(e)}")

@api_router.get("/rooms/{room_code}/game_state")
async def get_game_state(room_code: str, player_id: str):
    """Get current game state for a specific player"""
    game_state = manager.get_game_state(room_code)
    if not game_state:
        raise HTTPException(status_code=404, detail="Room not found")
    
    # Find the player
    player = next((p for p in game_state.players if p.id == player_id), None)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    
    # Determine if player can see legislative cards
    legislative_cards = []
    if game_state.turn.phase == Phase.LEGIS_REGENT and player.seat == game_state.turn.regent_seat:
        # Regent can see the cards during LEGIS_REGENT phase
        legislative_cards = game_state.turn.legislative_cards
    elif game_state.turn.phase == Phase.LEGIS_CHAMBELLAN and player.seat == game_state.turn.nominee_seat:
        # Chambellan can see the cards during LEGIS_CHAMBELLAN phase
        legislative_cards = game_state.turn.legislative_cards
    
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
        "players": [{"id": p.id, "name": p.name, "seat": p.seat, "alive": p.alive, "connected": p.connected} for p in game_state.players],
        "winner": game_state.winner,
        "version": game_state.version,
        "legislative_cards": legislative_cards
    }
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

# Duplicate chat endpoint removed - using the first implementation

# Get chat history endpoint
@api_router.get("/rooms/{room_code}/chat")
async def get_chat_history(room_code: str, player_id: str):
    """Get chat history for a room"""
    game_state = manager.get_game_state(room_code)
    if not game_state:
        raise HTTPException(status_code=404, detail="Room not found")
    
    # Find the player
    player = next((p for p in game_state.players if p.id == player_id), None)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    
    # Return chat history (for now, return empty - in a real app you'd store this)
    return {"messages": []}

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
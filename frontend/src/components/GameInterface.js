import React, { useState, useEffect } from 'react';
import { Crown, Sword, Shield, Users, Clock, Vote, Gavel, Eye, Skull, Send, MessageCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import NominationPanel from './NominationPanel';
import VotePanel from './VotePanel';
import LegislativePanel from './LegislativePanel';
import MedievalTable from './MedievalTable.js';
import '../styles/medieval-room.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Game Phase Component
const GamePhase = ({ phase, regentSeat, nomineeSeat, players }) => {
  const { t } = useTranslation();
  
  const getPhaseDisplay = (phase) => {
    switch(phase) {
      case 'NOMINATION': return { text: 'Nomination du Chambellan', icon: Crown, color: 'blue' };
      case 'VOTE': return { text: 'Vote pour le gouvernement', icon: Vote, color: 'purple' };
      case 'LEGIS_REGENT': return { text: 'Session législative - Régent', icon: Gavel, color: 'amber' };
      case 'LEGIS_CHAMBELLAN': return { text: 'Session législative - Chambellan', icon: Gavel, color: 'amber' };
      case 'POWER': return { text: 'Pouvoir du Régent', icon: Eye, color: 'red' };
      default: return { text: 'Phase inconnue', icon: Clock, color: 'gray' };
    }
  };
  
  const phaseInfo = getPhaseDisplay(phase);
  const PhaseIcon = phaseInfo.icon;
  
  const regent = players.find(p => p.seat === regentSeat);
  const nominee = nomineeSeat ? players.find(p => p.seat === nomineeSeat) : null;
  
  return (
    <Card className="game-info-parchment">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <PhaseIcon className={`h-6 w-6 text-${phaseInfo.color}-600`} />
            <CardTitle className="text-lg text-amber-900 font-cinzel">{phaseInfo.text}</CardTitle>
          </div>
          <Badge variant="outline" className="bg-amber-100 font-cinzel">
            Tour en cours
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex space-x-6">
          <div className="flex items-center space-x-2">
            <Crown className="h-4 w-4 text-yellow-600" />
            <span className="text-sm font-medium">
              Régent: {regent ? regent.name : 'N/A'}
            </span>
          </div>
          {nominee && (
            <div className="flex items-center space-x-2">
              <Users className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium">
                Chambellan proposé: {nominee.name}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// Decree Track Component
const DecreeTrack = ({ tracks, powers }) => {
  const { t } = useTranslation();
  
  const loyalMarkers = Array.from({ length: 5 }, (_, i) => i < tracks.loyal);
  const conjureMarkers = Array.from({ length: 6 }, (_, i) => i < tracks.conjure);
  
  const getPowerIcon = (index) => {
    switch(index) {
      case 1: return { icon: Eye, text: 'Investigation', unlocked: tracks.conjure >= 2 };
      case 2: return { icon: Crown, text: 'Élection Spéciale', unlocked: tracks.conjure >= 3 };
      case 3: return { icon: Skull, text: 'Exécution', unlocked: tracks.conjure >= 4 };
      case 4: return { icon: Skull, text: 'Exécution', unlocked: tracks.conjure >= 5 };
      default: return null;
    }
  };
  
  return (
    <div className="space-y-4">
      {/* Loyal Track */}
      <Card className="game-info-parchment">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center space-x-2 font-cinzel">
            <Shield className="h-4 w-4 text-blue-600" />
            <span>Décrets Loyaux</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-2">
            {loyalMarkers.map((filled, index) => (
              <div
                key={index}
                className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold ${
                  filled 
                    ? 'bg-blue-600 border-blue-600 text-white' 
                    : 'border-blue-300 text-blue-300'
                }`}
              >
                {index + 1}
              </div>
            ))}
            <div className="ml-4 text-sm text-blue-700 font-medium flex items-center font-fell">
              {tracks.loyal}/5 pour la victoire
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Conjure Track */}
      <Card className="game-info-parchment">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center space-x-2 font-cinzel">
            <Sword className="h-4 w-4 text-red-600" />
            <span>Décrets Conjurés</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-2">
            {conjureMarkers.map((filled, index) => {
              const power = getPowerIcon(index + 1);
              return (
                <div key={index} className="relative">
                  <div
                    className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold ${
                      filled 
                        ? 'bg-red-600 border-red-600 text-white' 
                        : 'border-red-300 text-red-300'
                    }`}
                  >
                    {index + 1}
                  </div>
                  {power && (
                    <div className={`absolute -bottom-6 left-1/2 transform -translate-x-1/2 ${
                      power.unlocked ? 'text-red-600' : 'text-gray-400'
                    }`}>
                      <power.icon className="h-3 w-3" />
                    </div>
                  )}
                </div>
              );
            })}
            <div className="ml-4 text-sm text-red-700 font-medium flex items-center">
              {tracks.conjure}/6 pour la victoire
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Crisis Track */}
      <Card className="game-info-parchment">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-cinzel">Piste de Crise</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2">
            <Progress value={(tracks.crisis / 3) * 100} className="flex-1" />
            <span className="text-sm font-medium font-fell">{tracks.crisis}/3</span>
          </div>
          <p className="text-xs text-amber-700 mt-1 font-fell">
            3 échecs consécutifs → Adoption automatique
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

// Chat Component
const ChatComponent = ({ roomCode, currentPlayerId, currentPlayerName }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Initialize chat with system message
  useEffect(() => {
    const systemMessage = {
      id: 'system-1',
      player_name: 'Système',
      message: 'La séance du conseil royal a commencé. Que les délibérations débutent !',
      timestamp: new Date().toISOString(),
      type: 'system'
    };
    setMessages([systemMessage]);
  }, []);

  const sendMessage = async () => {
    if (!newMessage.trim() || isSending) return;

    setIsSending(true);
    try {
      const response = await axios.post(`${API}/rooms/${roomCode}/chat`, null, {
        params: {
          player_id: currentPlayerId,
          message: newMessage
        }
      });
      
      if (response.data.success) {
        // Add message to local state immediately
        const newMsg = {
          id: Date.now(),
          player_name: currentPlayerName,
          message: newMessage,
          timestamp: new Date().toISOString(),
          type: 'player'
        };
        setMessages(prev => [...prev, newMsg]);
        setNewMessage('');
        console.log('Message sent successfully:', newMessage);
      }
      
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Erreur lors de l\'envoi du message: ' + (error.response?.data?.detail || error.message));
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <Card className="chat-parchment h-80 flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center space-x-2 font-cinzel">
          <MessageCircle className="h-5 w-5" />
          <span>Parchemin des Délibérations</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col space-y-3 p-3">
        {/* Messages Area */}
        <ScrollArea className="flex-1 pr-2">
          <div className="space-y-2">
            {messages.map((msg) => (
              <div key={msg.id} className={`p-2 rounded-lg text-sm font-fell ${
                msg.type === 'system' 
                  ? 'bg-amber-100 text-amber-800 italic border border-amber-300' 
                  : msg.player_name === currentPlayerName
                  ? 'bg-yellow-100 text-yellow-800 ml-2 border border-yellow-300'
                  : 'bg-gray-100 text-gray-800 border border-gray-300'
              }`}>
                <div className="font-cinzel font-semibold text-xs mb-1">
                  {msg.player_name}
                  <span className="text-xs opacity-60 ml-2 font-fell">
                    {new Date(msg.timestamp).toLocaleTimeString('fr-FR', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </span>
                </div>
                <div className="break-words">{msg.message}</div>
              </div>
            ))}
            {messages.length === 0 && (
              <div className="text-center text-gray-500 py-4">
                Aucun message pour le moment...
              </div>
            )}
          </div>
        </ScrollArea>
        
        {/* Input Area */}
        <div className="flex space-x-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Écrivez votre message..."
            className="flex-1 bg-amber-50 border-amber-300 font-fell"
            maxLength={200}
            disabled={isSending}
          />
          <Button 
            onClick={sendMessage}
            disabled={!newMessage.trim() || isSending}
            size="sm"
            className="px-3 bg-amber-600 hover:bg-amber-700 font-cinzel"
          >
            {isSending ? (
              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

// Players List Component
const PlayersList = ({ players, currentPlayerId, regentSeat, deadPlayers }) => {
  const { t } = useTranslation();
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Joueurs ({players.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {players.map((player) => (
            <div
              key={player.id}
              className={`flex items-center justify-between p-3 rounded-lg border ${
                player.id === currentPlayerId 
                  ? 'bg-amber-100 border-amber-300' 
                  : player.alive
                  ? 'bg-white border-gray-200'
                  : 'bg-gray-100 border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-full bg-amber-200 flex items-center justify-center text-sm font-bold">
                  {player.seat}
                </div>
                <div>
                  <p className={`font-medium ${!player.alive ? 'line-through text-gray-500' : ''}`}>
                    {player.name}
                    {player.id === currentPlayerId && ' (Vous)'}
                  </p>
                  <div className="flex items-center space-x-2">
                    {player.seat === regentSeat && (
                      <Badge variant="secondary" className="text-xs">
                        <Crown className="h-3 w-3 mr-1" />
                        Régent
                      </Badge>
                    )}
                    {!player.alive && (
                      <Badge variant="destructive" className="text-xs">
                        <Skull className="h-3 w-3 mr-1" />
                        Éliminé
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${
                  player.connected ? 'bg-green-500' : 'bg-red-500'
                }`} />
                <span className="text-xs text-gray-500">
                  {player.connected ? 'En ligne' : 'Hors ligne'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

// Role Display Component
const RoleDisplay = ({ role }) => {
  const { t } = useTranslation();
  
  if (!role) return null;
  
  const getRoleInfo = (role) => {
    switch(role) {
      case 'LOYAL': 
        return { 
          name: 'Chevalier Loyal', 
          color: 'blue', 
          icon: Shield,
          description: 'Défendez le royaume et démasquez les traîtres'
        };
      case 'CONJURE': 
        return { 
          name: 'Conjuré', 
          color: 'red', 
          icon: Sword,
          description: 'Répandez le chaos et aidez l\'Usurpateur'
        };
      case 'USURPATEUR': 
        return { 
          name: 'Usurpateur', 
          color: 'purple', 
          icon: Crown,
          description: 'Prenez le pouvoir en secret'
        };
      default: 
        return { name: 'Inconnu', color: 'gray', icon: Users, description: '' };
    }
  };
  
  const roleInfo = getRoleInfo(role);
  const RoleIcon = roleInfo.icon;
  
  return (
    <Card className="game-info-parchment">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-cinzel">Votre Rôle</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center space-x-3">
          <RoleIcon className={`h-8 w-8 text-${roleInfo.color}-600`} />
          <div>
            <p className={`font-bold text-${roleInfo.color}-800 font-cinzel`}>{roleInfo.name}</p>
            <p className={`text-xs text-${roleInfo.color}-600 font-fell`}>{roleInfo.description}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Main Game Interface Component
const GameInterface = ({ roomCode }) => {
  const { t } = useTranslation();
  const [gameState, setGameState] = useState(null);
  const [playerRole, setPlayerRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const currentPlayerId = localStorage.getItem('userId');
  const currentPlayerName = localStorage.getItem('playerName') || 'Joueur';
  
  // Load game state from API
  useEffect(() => {
    const loadGameState = async () => {
      if (!currentPlayerId) return;
      
      try {
        console.log('Loading game state for room:', roomCode);
        const response = await axios.get(`${API}/rooms/${roomCode}/game_state?player_id=${currentPlayerId}`);
        console.log('Game state loaded:', response.data);
        
        setGameState(response.data);
        setPlayerRole(response.data.your_role);
        setLoading(false);
        setError(null);
        
      } catch (error) {
        console.error('Error loading game state:', error);
        // Fallback to basic state if API fails
        const fallbackState = {
          status: 'in_progress',
          phase: 'NOMINATION',
          regent_seat: 1,
          nominee_seat: null,
          tracks: { loyal: 0, conjure: 0, crisis: 0 },
          players: [
            { id: currentPlayerId, name: currentPlayerName, seat: 1, alive: true, connected: true }
          ]
        };
        setGameState(fallbackState);
        setPlayerRole('LOYAL');
        setLoading(false);
      }
    };
    
    // Load initial state
    loadGameState();
    
    // Set up polling to refresh game state every 3 seconds
    const interval = setInterval(loadGameState, 3000);
    
    return () => {
      clearInterval(interval);
    };
  }, [roomCode, currentPlayerId]);
  
  if (loading) {
    return (
      <div className="medieval-room">
        {/* Atmospheric elements */}
        <div className="torch-light"></div>
        <div className="torch-light"></div>
        <div className="torch-light"></div>
        <div className="torch-light"></div>
        
        <div className="flex items-center justify-center min-h-screen">
          <Card className="game-info-parchment shadow-2xl p-8">
            <div className="text-center">
              <div className="animate-spin h-8 w-8 border-4 border-amber-600 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-amber-800 text-lg font-cinzel">Préparation de la salle du conseil...</p>
              <p className="text-amber-600 text-sm mt-2 font-fell">Room: {roomCode}</p>
            </div>
          </Card>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-900 via-amber-800 to-orange-900 flex items-center justify-center">
        <Card className="bg-red-50/95 backdrop-blur-sm border-red-200 shadow-xl p-8">
          <div className="text-center">
            <p className="text-red-800 text-lg mb-4">Erreur de connexion</p>
            <p className="text-red-600 text-sm">{error}</p>
            <Button 
              onClick={() => window.location.reload()} 
              className="mt-4 bg-red-600 hover:bg-red-700"
            >
              Recharger
            </Button>
          </div>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="medieval-room">
      {/* Atmospheric elements */}
      <div className="torch-light"></div>
      <div className="torch-light"></div>
      <div className="torch-light"></div>
      <div className="torch-light"></div>
      
      {/* Wall decorations */}
      <div className="wall-decoration">⚔️</div>
      <div className="wall-decoration">🛡️</div>
      <div className="wall-decoration">🗡️</div>
      
      {/* Castle window view */}
      <div className="castle-window"></div>
      
      <div className="max-w-7xl mx-auto space-y-6 p-4 relative z-10">
        {/* Header - Style parchemin */}
        <Card className="game-info-parchment">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl text-amber-900 font-cinzel">
                  Secretus Regnum
                </CardTitle>
                <p className="text-amber-700 font-fell">Room: {roomCode}</p>
              </div>
              <Badge variant="outline" className="bg-amber-100 font-cinzel">
                Partie en cours
              </Badge>
            </div>
          </CardHeader>
        </Card>
        
        {/* Game Phase */}
        <GamePhase 
          phase={gameState.phase}
          regentSeat={gameState.regent_seat}
          nomineeSeat={gameState.nominee_seat}
          players={gameState.players || []}
        />
        
        {/* Main Game Area */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Column - Role & Tracks */}
          <div className="space-y-4">
            <RoleDisplay role={playerRole} />
            <DecreeTrack 
              tracks={gameState.tracks || { loyal: 0, conjure: 0, crisis: 0 }}
              powers={gameState.powers || {}}
            />
          </div>
          
          {/* Center Column - Game Actions */}
          <div className="space-y-4">
            {/* Game Actions */}
            <Card className="chat-parchment">
              <CardHeader>
                <CardTitle className="text-lg font-cinzel">Actions de Jeu</CardTitle>
              </CardHeader>
              <CardContent>
                {/* Debug Info */}
                <div className="mb-4 p-3 bg-amber-100 rounded text-xs">
                  <p className="font-fell"><strong>Debug:</strong> Phase: {gameState.phase} | Régent: Siège {gameState.regent_seat} | Nominee: {gameState.nominee_seat || 'Aucun'}</p>
                  <p className="font-fell">Joueurs vivants: {gameState.players?.filter(p => p.alive).length || 0}</p>
                </div>

                {/* Phase-specific actions */}
                {gameState.phase === 'NOMINATION' && (
                  <NominationPanel
                    meSeat={gameState.players?.find(p => p.id === currentPlayerId)?.seat}
                    regentSeat={gameState.regent_seat}
                    players={gameState.players || []}
                    prevGovernment={gameState.prev_government}
                    onNominate={async (seat) => {
                      console.log('Nominating seat:', seat);
                      try {
                        await axios.post(`${API}/rooms/${roomCode}/action?player_id=${currentPlayerId}&action_type=NOMINATE`, {
                          nomineeSeat: seat
                        });
                        console.log('Nomination successful');
                      } catch (error) {
                        console.error('Nomination failed:', error);
                        alert('Erreur lors de la nomination: ' + (error.response?.data?.detail || error.message));
                      }
                    }}
                  />
                )}

                {gameState.phase === 'VOTE' && (
                  <VotePanel
                    players={gameState.players || []}
                    regentSeat={gameState.regent_seat}
                    nomineeSeat={gameState.nominee_seat}
                    votes={gameState.votes || {}}
                    myVote={gameState.votes?.[currentPlayerId]}
                    mySeat={gameState.players?.find(p => p.id === currentPlayerId)?.seat}
                    onVote={async (vote) => {
                      console.log('Voting:', vote);
                      try {
                        await axios.post(`${API}/rooms/${roomCode}/action?player_id=${currentPlayerId}&action_type=VOTE`, {
                          vote: vote
                        });
                        console.log('Vote successful');
                      } catch (error) {
                        console.error('Vote failed:', error);
                        alert('Erreur lors du vote: ' + (error.response?.data?.detail || error.message));
                      }
                    }}
                  />
                )}

                {(gameState.phase === 'LEGIS_REGENT' || gameState.phase === 'LEGIS_CHAMBELLAN') && (
                  <LegislativePanel
                    phase={gameState.phase}
                    mySeat={gameState.players?.find(p => p.id === currentPlayerId)?.seat}
                    regentSeat={gameState.regent_seat}
                    chambellanSeat={gameState.nominee_seat}
                    players={gameState.players || []}
                    cards={gameState.legislative_cards || []}
                    onDiscard={async (cardId) => {
                      console.log('Discarding card:', cardId);
                      try {
                        await axios.post(`${API}/rooms/${roomCode}/action?player_id=${currentPlayerId}&action_type=DISCARD`, {
                          cardId: cardId
                        });
                        console.log('Discard successful');
                      } catch (error) {
                        console.error('Discard failed:', error);
                        alert('Erreur lors de la défausse: ' + (error.response?.data?.detail || error.message));
                      }
                    }}
                  />
                )}

                {!['NOMINATION', 'VOTE', 'LEGIS_REGENT', 'LEGIS_CHAMBELLAN'].includes(gameState.phase) && (
                  <div className="text-center p-6">
                    <Clock className="h-12 w-12 text-amber-600 mx-auto mb-4" />
                    <p className="text-amber-800 text-lg mb-4 font-cinzel">
                      Phase: {gameState.phase}
                    </p>
                    <p className="text-amber-600 text-sm font-fell">
                      Actions en cours de développement pour cette phase
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Chat + Table */}
          <div className="lg:col-span-2 space-y-4">
            {/* Chat Component */}
            <ChatComponent 
              roomCode={roomCode}
              currentPlayerId={currentPlayerId}
              currentPlayerName={currentPlayerName}
            />
            
            {/* Medieval Round Table */}
            <div className="flex justify-center items-start">
              <MedievalTable 
                players={gameState.players?.map(player => ({
                  seat: player.seat,
                  name: player.name + (player.id === currentPlayerId ? ' (Vous)' : ''),
                  active: player.seat === gameState.regent_seat || player.seat === gameState.nominee_seat
                })) || []}
                size={500}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameInterface;
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

// Get role display info
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



// Decree Track Component - Two separate tracks
const DecreeTrack = ({ tracks, powers }) => {
  const { t } = useTranslation();
  
  const loyalMarkers = Array.from({ length: 5 }, (_, i) => i < tracks.loyal);
  const conjureMarkers = Array.from({ length: 6 }, (_, i) => i < tracks.conjure);

  return (
    <div className="space-y-4">
      {/* Loyal Track */}
      <Card className="game-info-parchment">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center space-x-2 font-cinzel">
            <Shield className="h-5 w-5 text-blue-600" />
            <span className="text-blue-800">Piste des Loyaux</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-1 mb-2">
            {loyalMarkers.map((filled, index) => (
              <div
                key={index}
                className={`w-10 h-10 rounded-lg border-2 flex items-center justify-center text-xs font-bold transition-all ${
                  filled 
                    ? 'bg-blue-600 border-blue-600 text-white shadow-lg' 
                    : 'border-blue-300 text-blue-300 bg-blue-50'
                }`}
              >
                <Shield className="h-4 w-4" />
              </div>
            ))}
          </div>
          <div className="text-xs text-blue-700 font-medium font-fell">
            🏆 {tracks.loyal}/5 - Victoire des Loyaux si 5 atteint
          </div>
        </CardContent>
      </Card>
      
      {/* Conjure Track */}
      <Card className="game-info-parchment">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center space-x-2 font-cinzel">
            <Sword className="h-5 w-5 text-red-600" />
            <span className="text-red-800">Piste des Conjurés</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-1 mb-2">
            {conjureMarkers.map((filled, index) => (
              <div
                key={index}
                className={`w-10 h-10 rounded-lg border-2 flex items-center justify-center text-xs font-bold transition-all ${
                  filled 
                    ? 'bg-red-600 border-red-600 text-white shadow-lg' 
                    : 'border-red-300 text-red-300 bg-red-50'
                }`}
              >
                <Sword className="h-4 w-4" />
              </div>
            ))}
          </div>
          <div className="text-xs text-red-700 font-medium font-fell">
            ⚔️ {tracks.conjure}/6 - Victoire des Conjurés si 6 atteint
          </div>
          
          {/* Powers display */}
          {tracks.conjure >= 2 && (
            <div className="mt-2 pt-2 border-t border-red-200">
              <div className="text-xs font-fell text-red-800">
                <p className="flex items-center space-x-1">
                  <Eye className="h-3 w-3" />
                  <span>2+ : Pouvoir d'Investigation</span>
                </p>
                {tracks.conjure >= 4 && (
                  <p className="flex items-center space-x-1">
                    <Skull className="h-3 w-3" />
                    <span>4+ : Pouvoir d'Exécution</span>
                  </p>
                )}
              </div>
            </div>
          )}
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
            ⚡ 3 échecs consécutifs → Adoption automatique
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

  // Initialize chat with system message and load history + setup polling
  useEffect(() => {
    const loadChatHistory = async () => {
      try {
        if (currentPlayerId && roomCode) {
          const response = await axios.get(`${API}/rooms/${roomCode}/chat?player_id=${currentPlayerId}`);
          if (response.data.messages && response.data.messages.length > 0) {
            setMessages(response.data.messages);
          } else {
            // If no messages, add system message
            const systemMessage = {
              id: 'system-1',
              player_name: 'Système',
              message: 'La séance du conseil royal a commencé. Que les délibérations débutent !',
              timestamp: new Date().toISOString(),
              type: 'system'
            };
            setMessages([systemMessage]);
          }
        }
      } catch (error) {
        console.error('Error loading chat history:', error);
        // Fallback to system message
        const systemMessage = {
          id: 'system-1',
          player_name: 'Système',
          message: 'La séance du conseil royal a commencé. Que les délibérations débutent !',
          timestamp: new Date().toISOString(),
          type: 'system'
        };
        setMessages([systemMessage]);
      }
    };

    loadChatHistory();

    // Set up polling for new messages every 2 seconds
    const pollInterval = setInterval(async () => {
      try {
        if (currentPlayerId && roomCode) {
          const response = await axios.get(`${API}/rooms/${roomCode}/chat?player_id=${currentPlayerId}`);
          if (response.data.messages) {
            setMessages(prevMessages => {
              const newMessages = response.data.messages;
              // Check if there are new messages
              if (newMessages.length > prevMessages.length) {
                // Play notification sound for new messages
                try {
                  const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hTEw1Mp+DyvmIcBSuTrIrEiikEO1gqvWFBCj+B2vLCcCQF');
                  audio.volume = 0.3;
                  audio.play().catch(() => {}); // Ignore errors
                } catch (e) {}
                
                // Scroll to bottom after new message
                setTimeout(() => {
                  const chatContainer = document.querySelector('.chat-scroll-area');
                  if (chatContainer) {
                    chatContainer.scrollTop = chatContainer.scrollHeight;
                  }
                }, 100);
              }
              return newMessages;
            });
          }
        }
      } catch (error) {
        console.error('Error polling chat messages:', error);
      }
    }, 2000);

    return () => {
      clearInterval(pollInterval);
    };
  }, [currentPlayerId, roomCode]);

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
        <ScrollArea className="flex-1 pr-2 chat-scroll-area max-h-64 overflow-y-auto">
          <div className="space-y-2">
            {messages.map((msg) => (
              <div key={msg.id} className={`p-2 rounded-lg text-sm font-fell transition-all duration-300 ${
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
        
        {/* Input Area - Fixed on mobile */}
        <div className="flex space-x-2 sticky bottom-0 md:static bg-amber-50 p-2 md:p-0 rounded-lg md:rounded-none border md:border-none border-amber-300">
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
  const [mobileTab, setMobileTab] = useState('game'); // 'game', 'tracks', 'chat'
  
  // Chat state variables
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  
  const currentPlayerId = localStorage.getItem('userId');
  const currentPlayerName = localStorage.getItem('playerName') || 'Joueur';
  
  // Get current player info
  const getCurrentPlayer = () => {
    return gameState?.players?.find(p => p.id === currentPlayerId);
  };
  
  // Chat functions
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
      
      <div className="max-w-full mx-auto relative z-10">
        {/* Sticky Header Banner */}
        <div className="sticky top-0 z-20 bg-gradient-to-r from-amber-900/95 to-amber-800/95 backdrop-blur-sm border-b-2 border-amber-600 shadow-lg">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <h1 className="text-2xl font-uncial text-amber-100">Secretus Regnum</h1>
                <Badge className="bg-amber-700 text-amber-100 font-cinzel">
                  Room: {roomCode}
                </Badge>
              </div>
              
              <div className="flex items-center space-x-4">
                {/* Current Phase */}
                <div className="text-center">
                  <p className="text-xs text-amber-300 font-fell">Phase actuelle</p>
                  <p className="text-lg font-cinzel text-amber-100">{gameState.phase}</p>
                </div>
                
                {/* Regent Info */}
                {gameState.regent_seat && (
                  <div className="text-center hidden md:block">
                    <p className="text-xs text-amber-300 font-fell">Régent</p>
                    <p className="text-sm font-cinzel text-amber-100">
                      Siège {gameState.regent_seat}
                      {gameState.players?.find(p => p.seat === gameState.regent_seat)?.name && 
                        ` (${gameState.players.find(p => p.seat === gameState.regent_seat).name})`
                      }
                    </p>
                  </div>
                )}
                
                {/* Player Role */}
                {playerRole && (
                  <div className="text-center hidden lg:block">
                    <p className="text-xs text-amber-300 font-fell">Votre rôle</p>
                    <p className="text-sm font-cinzel text-amber-100">{getRoleInfo(playerRole).name}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Main Game Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-4 min-h-screen">
          
          {/* Left Column - Game Tracks (Desktop) / Conditional Mobile */}
          <div className={`space-y-4 lg:max-h-screen lg:overflow-y-auto ${
            mobileTab === 'tracks' ? 'block lg:block' : 'hidden lg:block'
          }`}>
            <DecreeTrack 
              tracks={gameState.tracks || { loyal: 0, conjure: 0, crisis: 0 }}
              powers={gameState.powers || {}}
            />
          </div>

          {/* Center Column - Table + Actions (Desktop) / Game Tab (Mobile) */}
          <div className={`flex flex-col space-y-4 ${
            mobileTab === 'game' ? 'block lg:block' : 'hidden lg:block'
          }`}>
            {/* Game Actions */}
            <Card className="chat-parchment">
              <CardHeader>
                <CardTitle className="text-lg font-cinzel">Actions de Jeu</CardTitle>
              </CardHeader>
              <CardContent>
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
                      En attente des actions...
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Medieval Round Table - Reduced size, centered */}
            <div className="flex justify-center items-center">
              <div className="w-full max-w-md lg:max-w-lg">
                <MedievalTable 
                  players={gameState.players?.map(player => ({
                    seat: player.seat,
                    name: player.name + (player.id === currentPlayerId ? ' (Vous)' : ''),
                    active: player.seat === gameState.regent_seat || player.seat === gameState.nominee_seat
                  })) || []}
                  size={320}
                />
              </div>
            </div>
          </div>

          {/* Right Column - Chat (Desktop) / Chat Tab (Mobile) */}
          <div className={`space-y-4 lg:max-h-screen lg:overflow-y-auto ${
            mobileTab === 'chat' ? 'block lg:block' : 'hidden lg:block'
          }`}>
            <ChatComponent 
              roomCode={roomCode}
              currentPlayerId={currentPlayerId}
              currentPlayerName={currentPlayerName}
            />
          </div>
        </div>

        {/* Mobile Tabs - Functional navigation */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-amber-900/95 backdrop-blur-sm border-t-2 border-amber-600 z-30">
          <div className="flex">
            <button 
              onClick={() => setMobileTab('game')}
              className={`flex-1 p-3 text-center font-cinzel border-r border-amber-700 transition-all ${
                mobileTab === 'game' 
                  ? 'bg-amber-600 text-white' 
                  : 'text-amber-100 hover:bg-amber-800'
              }`}
            >
              🏰 Jeu
            </button>
            <button 
              onClick={() => setMobileTab('tracks')}
              className={`flex-1 p-3 text-center font-cinzel border-r border-amber-700 transition-all ${
                mobileTab === 'tracks' 
                  ? 'bg-amber-600 text-white' 
                  : 'text-amber-100 hover:bg-amber-800'
              }`}
            >
              📊 Pistes
            </button>
            <button 
              onClick={() => setMobileTab('chat')}
              className={`flex-1 p-3 text-center font-cinzel transition-all ${
                mobileTab === 'chat' 
                  ? 'bg-amber-600 text-white' 
                  : 'text-amber-100 hover:bg-amber-800'
              }`}
            >
              💬 Chat
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameInterface;
import React, { useState, useEffect } from 'react';
import { Crown, Sword, Shield, Users, Clock, Vote, Gavel, Eye, Skull, Send, MessageCircle, Zap } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import NominationPanel from './NominationPanel';
import VotePanel from './VotePanel';
import LegislativePanel from './LegislativePanel';
import MedievalTable from './MedievalTable.js';

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

// Track Component for clean display
const TrackComponent = ({ title, current, max, color, icon: Icon }) => {
  return (
    <Card className="bg-gray-800 border-gray-700 shadow-lg">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center space-x-2 text-gray-100">
          <Icon className={`h-5 w-5 text-${color}-400`} />
          <span>{title}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex space-x-2 mb-3">
          {Array.from({ length: max }, (_, i) => (
            <div
              key={i}
              className={`w-10 h-10 rounded-lg border-2 flex items-center justify-center text-lg font-bold transition-all ${
                i < current
                  ? `bg-${color}-600 border-${color}-500 text-white shadow-md` 
                  : `border-${color}-300 text-${color}-300 bg-gray-700`
              }`}
            >
              {title === 'Loyaux' ? '🛡️' : title === 'Conjurés' ? '⚔️' : '⚡'}
            </div>
          ))}
        </div>
        <div className={`text-sm font-medium text-${color}-400 text-center`}>
          {current}/{max} {title === 'Crise' ? '→ Adoption auto' : '→ Victoire'}
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
  const [mobileTab, setMobileTab] = useState('table'); // 'table', 'tracks', 'chat'
  
  // Chat state variables
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  
  const currentPlayerId = localStorage.getItem('userId');
  const currentPlayerName = localStorage.getItem('playerName') || 'Joueur';
  
  // Middle Earth music for game
  useEffect(() => {
    const audio = new Audio('https://customer-assets.emergentagent.com/job_1a735b74-0d1b-4cfc-aa0c-5d6b585ff99b/artifacts/x03qntuf_Middle%20Earth%20%28Copyright%20Free%20Fantasy%20Music%20inspired%20by%20Lord%20of%20the%20Rings%29.mp3');
    audio.loop = true;
    audio.volume = 0.2;
    
    // Auto-play game music
    audio.play().catch(console.error);
    
    return () => {
      audio.pause();
    };
  }, []);
  
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
  
  // Chat useEffect for loading messages and polling
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
              message: 'Le Dark Oath a commencé. Que les conspirations débutent...',
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
          message: 'Le Dark Oath a commencé. Que les conspirations débutent...',
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
                // Auto-scroll to bottom
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
  
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Card className="bg-gray-800 border-gray-700 shadow-xl p-8">
          <div className="text-center">
            <div className="animate-spin h-8 w-8 border-4 border-amber-600 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-100 text-lg">Chargement de Dark Oath...</p>
            <p className="text-gray-400 text-sm mt-2">Room: {roomCode}</p>
          </div>
        </Card>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Card className="bg-red-900 border-red-700 shadow-xl p-8">
          <div className="text-center">
            <p className="text-red-100 text-lg mb-4">Erreur de connexion</p>
            <p className="text-red-300 text-sm">{error}</p>
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
    <div className="min-h-screen bg-slate-900 text-gray-100" style={{ minHeight: '100dvh' }}>
      {/* Header Bar */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-bold text-amber-400">Dark Oath</h1>
            <Badge className="bg-amber-600 text-black">
              {roomCode}
            </Badge>
          </div>
          
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-400">Phase: {gameState.phase}</span>
            {gameState.regent_seat && (
              <span className="text-sm text-gray-400 hidden md:block">
                Régent: Siège {gameState.regent_seat}
              </span>
            )}
            {playerRole && (
              <div className="flex items-center space-x-2">
                {getRoleInfo(playerRole).icon === Shield && <span className="text-blue-400">🛡️</span>}
                {getRoleInfo(playerRole).icon === Sword && <span className="text-red-400">⚔️</span>}
                {getRoleInfo(playerRole).icon === Crown && <span className="text-purple-400">👑</span>}
                <span className="text-sm font-medium text-gray-300">
                  {getRoleInfo(playerRole).name}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* DESKTOP LAYOUT (≥1024px) */}
      <div className="hidden lg:flex h-full" style={{ height: 'calc(100dvh - 73px)' }}>
        
        {/* Left Column - Tracks (Pistes) */}
        <div className="w-80 p-4 space-y-4 bg-gray-900 border-r border-gray-700">
          {/* Piste des Loyaux (5 cases) */}
          <TrackComponent 
            title="Loyaux"
            current={gameState.tracks?.loyal || 0}
            max={5}
            color="blue"
            icon={Shield}
          />
          
          {/* Piste des Conjurés (6 cases) */}
          <TrackComponent 
            title="Conjurés"
            current={gameState.tracks?.conjure || 0}
            max={6}
            color="red"
            icon={Sword}
          />
          
          {/* Piste de Crise (3 cases) */}
          <TrackComponent 
            title="Crise"
            current={gameState.tracks?.crisis || 0}
            max={3}
            color="yellow"
            icon={Zap}
          />
        </div>

        {/* Center Column - Table */}
        <div className="flex-1 flex flex-col items-center justify-center p-4 bg-slate-900">
          <div className="w-full max-w-md">
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

        {/* Right Column - Chat + Actions */}
        <div className="w-80 p-4 flex flex-col space-y-4 bg-gray-900 border-l border-gray-700">
          
          {/* Chat */}
          <Card className="bg-gray-800 border-gray-700 flex-1 flex flex-col min-h-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center space-x-2 text-gray-100">
                <MessageCircle className="h-5 w-5" />
                <span>Conspirations</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col space-y-3 p-3 min-h-0">
              {/* Messages Area */}
              <ScrollArea className="flex-1 pr-2 chat-scroll-area min-h-0">
                <div className="space-y-2">
                  {messages.map((msg) => (
                    <div key={msg.id} className={`p-3 rounded-lg text-sm transition-all ${
                      msg.type === 'system' 
                        ? 'bg-purple-900 text-purple-100 border border-purple-700' 
                        : msg.player_name === currentPlayerName
                        ? 'bg-amber-900 text-amber-100 border border-amber-700'
                        : 'bg-gray-700 text-gray-100 border border-gray-600'
                    }`}>
                      <div className="font-semibold text-xs mb-1 opacity-75">
                        {msg.player_name}
                        <span className="text-xs opacity-60 ml-2">
                          {new Date(msg.timestamp).toLocaleTimeString('fr-FR', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </span>
                      </div>
                      <div className="break-words">{msg.message}</div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              
              {/* Input Area */}
              <div className="flex space-x-2 flex-shrink-0">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Chuchotez vos secrets..."
                  className="flex-1 bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400"
                  maxLength={200}
                  disabled={isSending}
                />
                <Button 
                  onClick={sendMessage}
                  disabled={!newMessage.trim() || isSending}
                  size="sm"
                  className="px-4 bg-amber-600 hover:bg-amber-700 text-black"
                >
                  {isSending ? (
                    <div className="animate-spin h-4 w-4 border-2 border-black border-t-transparent rounded-full" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Actions Panel */}
          <Card className="bg-gray-800 border-gray-700 flex-shrink-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-gray-100">Actions - {gameState.phase}</CardTitle>
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
                <div className="text-center p-4">
                  <Clock className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-300 text-sm">
                    En attente des actions...
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* MOBILE LAYOUT */}
      <div className="lg:hidden flex flex-col h-full" style={{ height: 'calc(100dvh - 73px)' }}>
        
        {/* Mobile Content Area */}
        <div className="flex-1 p-4" style={{ paddingBottom: 'calc(60px + env(safe-area-inset-bottom))' }}>
          
          {/* Table Tab */}
          {mobileTab === 'table' && (
            <div className="h-full flex flex-col items-center justify-start space-y-4">
              
              {/* Actions Panel - Above table on mobile */}
              <Card className="bg-gray-800 border-gray-700 w-full">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg text-gray-100">Actions - {gameState.phase}</CardTitle>
                </CardHeader>
                <CardContent>
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
                    <div className="text-center p-4">
                      <Clock className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-300 text-sm">
                        En attente des actions...
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
              
              {/* Compact Table */}
              <div className="w-full max-w-xs">
                <MedievalTable 
                  players={gameState.players?.map(player => ({
                    seat: player.seat,
                    name: player.name.length > 8 ? player.name.substring(0, 8) + '...' : player.name,
                    active: player.seat === gameState.regent_seat || player.seat === gameState.nominee_seat
                  })) || []}
                  size={240}
                />
              </div>
            </div>
          )}

          {/* Tracks Tab */}
          {mobileTab === 'tracks' && (
            <div className="space-y-4">
              {/* Piste des Loyaux (5 cases) */}
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center space-x-2 text-gray-100">
                    <Shield className="h-5 w-5 text-blue-400" />
                    <span>Loyaux</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex space-x-2 mb-3">
                    {Array.from({ length: 5 }, (_, i) => (
                      <div
                        key={i}
                        className={`w-12 h-12 rounded-lg border-2 flex items-center justify-center text-xl font-bold transition-all ${
                          i < (gameState.tracks?.loyal || 0)
                            ? 'bg-blue-600 border-blue-500 text-white shadow-md' 
                            : 'border-blue-300 text-blue-300 bg-gray-700'
                        }`}
                      >
                        🛡️
                      </div>
                    ))}
                  </div>
                  <p className="text-sm text-blue-400 text-center font-medium">
                    {gameState.tracks?.loyal || 0}/5 → Victoire
                  </p>
                </CardContent>
              </Card>

              {/* Piste des Conjurés (6 cases) */}
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center space-x-2 text-gray-100">
                    <Sword className="h-5 w-5 text-red-400" />
                    <span>Conjurés</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex space-x-2 mb-3">
                    {Array.from({ length: 6 }, (_, i) => (
                      <div
                        key={i}
                        className={`w-12 h-12 rounded-lg border-2 flex items-center justify-center text-xl font-bold transition-all ${
                          i < (gameState.tracks?.conjure || 0)
                            ? 'bg-red-600 border-red-500 text-white shadow-md' 
                            : 'border-red-300 text-red-300 bg-gray-700'
                        }`}
                      >
                        ⚔️
                      </div>
                    ))}
                  </div>
                  <p className="text-sm text-red-400 text-center font-medium">
                    {gameState.tracks?.conjure || 0}/6 → Victoire
                  </p>
                </CardContent>
              </Card>

              {/* Piste de Crise (3 cases) */}
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center space-x-2 text-gray-100">
                    <Zap className="h-5 w-5 text-yellow-400" />
                    <span>Crise</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex space-x-2 mb-3">
                    {Array.from({ length: 3 }, (_, i) => (
                      <div
                        key={i}
                        className={`w-12 h-12 rounded-lg border-2 flex items-center justify-center text-xl font-bold transition-all ${
                          i < (gameState.tracks?.crisis || 0)
                            ? 'bg-yellow-600 border-yellow-500 text-white shadow-md' 
                            : 'border-yellow-300 text-yellow-300 bg-gray-700'
                        }`}
                      >
                        ⚡
                      </div>
                    ))}
                  </div>
                  <p className="text-sm text-yellow-400 text-center font-medium">
                    {gameState.tracks?.crisis || 0}/3 → Adoption auto
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Chat Tab */}
          {mobileTab === 'chat' && (
            <Card className="bg-gray-800 border-gray-700 h-full flex flex-col">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center space-x-2 text-gray-100">
                  <MessageCircle className="h-5 w-5" />
                  <span>Conspirations</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col p-3 min-h-0">
                {/* Messages Area */}
                <ScrollArea className="flex-1 pr-2 chat-scroll-area min-h-0 mb-4">
                  <div className="space-y-2">
                    {messages.map((msg) => (
                      <div key={msg.id} className={`p-3 rounded-lg text-sm transition-all ${
                        msg.type === 'system' 
                          ? 'bg-purple-900 text-purple-100 border border-purple-700' 
                          : msg.player_name === currentPlayerName
                          ? 'bg-amber-900 text-amber-100 border border-amber-700'
                          : 'bg-gray-700 text-gray-100 border border-gray-600'
                      }`}>
                        <div className="font-semibold text-xs mb-1 opacity-75">
                          {msg.player_name}
                          <span className="text-xs opacity-60 ml-2">
                            {new Date(msg.timestamp).toLocaleTimeString('fr-FR', { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </span>
                        </div>
                        <div className="break-words">{msg.message}</div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                
                {/* Input Area - Mobile keyboard friendly */}
                <div className="flex space-x-2 flex-shrink-0 border-t border-gray-700 pt-3">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Chuchotez vos secrets..."
                    className="flex-1 bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400"
                    maxLength={200}
                    disabled={isSending}
                  />
                  <Button 
                    onClick={sendMessage}
                    disabled={!newMessage.trim() || isSending}
                    size="sm"
                    className="px-4 bg-amber-600 hover:bg-amber-700 text-black"
                    style={{ minHeight: '44px', minWidth: '44px' }}
                  >
                    {isSending ? (
                      <div className="animate-spin h-4 w-4 border-2 border-black border-t-transparent rounded-full" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Mobile Tabs Navigation - Fixed at bottom with safe area */}
        <div 
          className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 z-30"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="flex">
            <button 
              onClick={() => setMobileTab('table')}
              className={`flex-1 p-3 text-center font-medium transition-all ${
                mobileTab === 'table' 
                  ? 'bg-amber-600 text-black' 
                  : 'text-gray-300 hover:bg-gray-700'
              }`}
              style={{ minHeight: '44px' }}
            >
              🏰 Table
            </button>
            <button 
              onClick={() => setMobileTab('tracks')}
              className={`flex-1 p-3 text-center font-medium border-l border-gray-700 transition-all ${
                mobileTab === 'tracks' 
                  ? 'bg-amber-600 text-black' 
                  : 'text-gray-300 hover:bg-gray-700'
              }`}
              style={{ minHeight: '44px' }}
            >
              📊 Pistes
            </button>
            <button 
              onClick={() => setMobileTab('chat')}
              className={`flex-1 p-3 text-center font-medium border-l border-gray-700 transition-all ${
                mobileTab === 'chat' 
                  ? 'bg-amber-600 text-black' 
                  : 'text-gray-300 hover:bg-gray-700'
              }`}
              style={{ minHeight: '44px' }}
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
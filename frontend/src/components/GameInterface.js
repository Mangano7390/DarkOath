import React, { useState, useEffect } from 'react';
import { Crown, Sword, Shield, Users, Clock, Vote, Gavel, Eye, Skull, Send, MessageCircle } from 'lucide-react';
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
      <div className="medieval-room">
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
      
      <div className="h-screen flex flex-col">
        
        {/* DESKTOP LAYOUT */}
        <div className="hidden md:flex flex-col h-full">
          
          {/* Top Section - Pistes de progression (centre haut) */}
          <div className="flex-shrink-0 p-4">
            <div className="flex justify-center space-x-8">
              
              {/* Piste des Loyaux */}
              <Card className="game-info-parchment">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center space-x-2 font-cinzel">
                    <Shield className="h-6 w-6 text-blue-600" />
                    <span className="text-blue-800">Piste des Loyaux</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex space-x-2 mb-2">
                    {Array.from({ length: 5 }, (_, i) => (
                      <div
                        key={i}
                        className={`w-14 h-14 rounded-lg border-2 flex items-center justify-center font-bold text-2xl transition-all ${
                          i < (gameState.tracks?.loyal || 0)
                            ? 'bg-blue-600 border-blue-600 text-white shadow-lg' 
                            : 'border-blue-300 text-blue-300 bg-blue-50'
                        }`}
                      >
                        🛡️
                      </div>
                    ))}
                  </div>
                  <div className="text-sm text-blue-700 font-medium font-fell text-center">
                    🏆 {gameState.tracks?.loyal || 0}/5 cases - Victoire si 5 remplies
                  </div>
                </CardContent>
              </Card>

              {/* Piste des Conjurés */}
              <Card className="game-info-parchment">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center space-x-2 font-cinzel">
                    <Sword className="h-6 w-6 text-red-600" />
                    <span className="text-red-800">Piste des Conjurés</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex space-x-2 mb-2">
                    {Array.from({ length: 6 }, (_, i) => (
                      <div
                        key={i}
                        className={`w-14 h-14 rounded-lg border-2 flex items-center justify-center font-bold text-2xl transition-all ${
                          i < (gameState.tracks?.conjure || 0)
                            ? 'bg-red-600 border-red-600 text-white shadow-lg' 
                            : 'border-red-300 text-red-300 bg-red-50'
                        }`}
                      >
                        ⚔️
                      </div>
                    ))}
                  </div>
                  <div className="text-sm text-red-700 font-medium font-fell text-center">
                    ⚔️ {gameState.tracks?.conjure || 0}/6 cases - Victoire si 6 remplies
                  </div>
                  {/* Powers display */}
                  {(gameState.tracks?.conjure || 0) >= 2 && (
                    <div className="mt-2 pt-2 border-t border-red-200">
                      <div className="text-xs font-fell text-red-800 text-center">
                        <p>👁️ Investigation (2+)</p>
                        {(gameState.tracks?.conjure || 0) >= 4 && <p>💀 Exécution (4+)</p>}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Main Layout - 3 columns */}
          <div className="flex-1 flex min-h-0">
            
            {/* Left Column - Piste de Crise */}
            <div className="w-72 p-4">
              <Card className="game-info-parchment">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-cinzel">Piste de Crise</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Progress value={((gameState.tracks?.crisis || 0) / 3) * 100} className="flex-1" />
                      <span className="text-lg font-medium font-fell">{gameState.tracks?.crisis || 0}/3</span>
                    </div>
                    <p className="text-sm text-amber-700 font-fell text-center">
                      ⚡ 3 échecs → Adoption automatique
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Center Column - Table Ronde (40% width, centrée en bas) */}
            <div className="flex-1 flex flex-col justify-end items-center p-4">
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

            {/* Right Column - Chat + Phase Panels */}
            <div className="w-80 p-4 flex flex-col space-y-4">
              
              {/* Chat - Parchemin scrollable */}
              <Card className="chat-parchment flex-1 flex flex-col min-h-0">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center space-x-2 font-cinzel">
                    <MessageCircle className="h-5 w-5" />
                    <span>Chat</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col space-y-3 p-3 min-h-0">
                  {/* Messages Area - Scrollable */}
                  <ScrollArea className="flex-1 pr-2 chat-scroll-area min-h-0">
                    <div className="space-y-2">
                      {messages.map((msg) => (
                        <div key={msg.id} className={`p-2 rounded-lg text-sm font-fell ${
                          msg.type === 'system' 
                            ? 'bg-amber-100 text-amber-800 italic border border-amber-300' 
                            : msg.player_name === currentPlayerName
                            ? 'bg-yellow-100 text-yellow-800 border border-yellow-300'
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
                    </div>
                  </ScrollArea>
                  
                  {/* Input Area */}
                  <div className="flex space-x-2 flex-shrink-0">
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

              {/* Phase/Vote Panels - Under Chat, no overlap */}
              <Card className="chat-parchment flex-shrink-0">
                <CardHeader>
                  <CardTitle className="text-lg font-cinzel">Actions - Phase: {gameState.phase}</CardTitle>
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
                      <Clock className="h-8 w-8 text-amber-600 mx-auto mb-2" />
                      <p className="text-amber-800 text-sm font-cinzel">
                        En attente des actions...
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* MOBILE LAYOUT - Responsive with tabs */}
        <div className="md:hidden flex flex-col h-full">
          
          {/* Mobile Content Area */}
          <div className="flex-1 p-4 pb-20">
            
            {/* Table Tab */}
            {mobileTab === 'table' && (
              <div className="h-full flex flex-col items-center justify-center space-y-4">
                {/* Compact table with just pseudos in circle */}
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
                
                {/* Phase info */}
                <Card className="game-info-parchment w-full">
                  <CardContent className="p-4 text-center">
                    <p className="font-cinzel text-lg">Phase: {gameState.phase}</p>
                    {gameState.regent_seat && (
                      <p className="font-fell text-sm text-amber-700">
                        Régent: Siège {gameState.regent_seat}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Tracks Tab */}
            {mobileTab === 'tracks' && (
              <div className="space-y-4">
                {/* Pistes de progression */}
                <Card className="game-info-parchment">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center space-x-2 font-cinzel">
                      <Shield className="h-5 w-5 text-blue-600" />
                      <span className="text-blue-800">Piste des Loyaux</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex space-x-1 mb-2">
                      {Array.from({ length: 5 }, (_, i) => (
                        <div
                          key={i}
                          className={`w-10 h-10 rounded border-2 flex items-center justify-center text-lg transition-all ${
                            i < (gameState.tracks?.loyal || 0)
                              ? 'bg-blue-600 border-blue-600 text-white' 
                              : 'border-blue-300 text-blue-300 bg-blue-50'
                          }`}
                        >
                          🛡️
                        </div>
                      ))}
                    </div>
                    <p className="text-sm text-blue-700 font-fell text-center">
                      {gameState.tracks?.loyal || 0}/5 - Victoire si 5 remplies
                    </p>
                  </CardContent>
                </Card>

                <Card className="game-info-parchment">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center space-x-2 font-cinzel">
                      <Sword className="h-5 w-5 text-red-600" />
                      <span className="text-red-800">Piste des Conjurés</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex space-x-1 mb-2">
                      {Array.from({ length: 6 }, (_, i) => (
                        <div
                          key={i}
                          className={`w-10 h-10 rounded border-2 flex items-center justify-center text-lg transition-all ${
                            i < (gameState.tracks?.conjure || 0)
                              ? 'bg-red-600 border-red-600 text-white' 
                              : 'border-red-300 text-red-300 bg-red-50'
                          }`}
                        >
                          ⚔️
                        </div>
                      ))}
                    </div>
                    <p className="text-sm text-red-700 font-fell text-center">
                      {gameState.tracks?.conjure || 0}/6 - Victoire si 6 remplies
                    </p>
                  </CardContent>
                </Card>

                <Card className="game-info-parchment">
                  <CardHeader>
                    <CardTitle className="text-lg font-cinzel">Piste de Crise</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center space-x-2">
                      <Progress value={((gameState.tracks?.crisis || 0) / 3) * 100} className="flex-1" />
                      <span className="text-lg font-medium font-fell">{gameState.tracks?.crisis || 0}/3</span>
                    </div>
                    <p className="text-sm text-amber-700 font-fell text-center mt-2">
                      ⚡ 3 échecs → Adoption automatique
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Chat Tab */}
            {mobileTab === 'chat' && (
              <Card className="chat-parchment h-full flex flex-col">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center space-x-2 font-cinzel">
                    <MessageCircle className="h-5 w-5" />
                    <span>Chat</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col p-3 min-h-0">
                  {/* Messages Area */}
                  <ScrollArea className="flex-1 pr-2 chat-scroll-area min-h-0 mb-4">
                    <div className="space-y-2">
                      {messages.map((msg) => (
                        <div key={msg.id} className={`p-2 rounded-lg text-sm font-fell ${
                          msg.type === 'system' 
                            ? 'bg-amber-100 text-amber-800 italic border border-amber-300' 
                            : msg.player_name === currentPlayerName
                            ? 'bg-yellow-100 text-yellow-800 border border-yellow-300'
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
                    </div>
                  </ScrollArea>
                  
                  {/* Input Area - Fixed at bottom */}
                  <div className="flex space-x-2 flex-shrink-0 border-t pt-3">
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
            )}
          </div>

          {/* Mobile Tabs Navigation - Fixed at bottom */}
          <div className="fixed bottom-0 left-0 right-0 bg-amber-900/95 backdrop-blur-sm border-t-2 border-amber-600 z-30">
            <div className="flex">
              <button 
                onClick={() => setMobileTab('table')}
                className={`flex-1 p-3 text-center font-cinzel border-r border-amber-700 transition-all ${
                  mobileTab === 'table' 
                    ? 'bg-amber-600 text-white' 
                    : 'text-amber-100 hover:bg-amber-800'
                }`}
              >
                🏰 Table
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
    </div>
  );
};

export default GameInterface;
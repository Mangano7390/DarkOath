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
import '../styles/medieval-room.css';
import NominationPanel from './NominationPanel';
import VotePanel from './VotePanel';
import LegislativePanel from './LegislativePanel';
import MedievalTable from './MedievalTable';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Medieval Game Room Component
const MedievalGameRoom = ({ roomCode }) => {
  const { t } = useTranslation();
  const [gameState, setGameState] = useState(null);
  const [playerRole, setPlayerRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  
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

  // Initialize chat messages and WebSocket connection
  useEffect(() => {
    // Initialize with system message
    const initMessages = [
      { 
        id: 1, 
        player_name: 'Système', 
        message: 'La séance du conseil royal a commencé. Que les délibérations débutent !', 
        timestamp: new Date().toISOString(), 
        type: 'system' 
      }
    ];
    setMessages(initMessages);

    // Set up WebSocket connection for real-time chat
    if (currentPlayerId && roomCode) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsHost = BACKEND_URL.replace('http://', '').replace('https://', '');
      const wsUrl = `${protocol}//${wsHost}/ws/${roomCode}/${currentPlayerId}`;
      
      try {
        const ws = new WebSocket(wsUrl);
        
        ws.onopen = () => {
          console.log('WebSocket connected for chat');
        };
        
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'chat_message') {
              const newMessage = {
                id: Date.now() + Math.random(),
                player_name: data.player_name,
                message: data.message,
                timestamp: data.timestamp,
                type: 'player'
              };
              setMessages(prev => [...prev, newMessage]);
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };
        
        ws.onclose = () => {
          console.log('WebSocket disconnected');
        };
        
        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
        };
        
        return () => {
          ws.close();
        };
      } catch (error) {
        console.error('Failed to establish WebSocket connection:', error);
      }
    }
  }, [roomCode, currentPlayerId]);

  // Send chat message
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
        setNewMessage('');
      }
      
    } catch (error) {
      console.error('Error sending message:', error);
      // Fallback: add message locally if API fails
      const fallbackMsg = {
        id: Date.now(),
        player_name: currentPlayerName,
        message: newMessage,
        timestamp: new Date().toISOString(),
        type: 'player'
      };
      setMessages(prev => [...prev, fallbackMsg]);
      setNewMessage('');
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

  // Get current player info
  const getCurrentPlayer = () => {
    return gameState?.players?.find(p => p.id === currentPlayerId);
  };

  // Get role display info
  const getRoleInfo = (role) => {
    switch(role) {
      case 'LOYAL': 
        return { name: 'Chevalier Loyal', color: 'text-blue-400', icon: '🛡️' };
      case 'CONJURE': 
        return { name: 'Conjuré', color: 'text-red-400', icon: '⚔️' };
      case 'USURPATEUR': 
        return { name: 'Usurpateur', color: 'text-purple-400', icon: '👑' };
      default: 
        return { name: 'Noble', color: 'text-gray-400', icon: '🏰' };
    }
  };

  // Render player seat
  const renderPlayerSeat = (player, index) => {
    const isCurrentPlayer = player.id === currentPlayerId;
    const isRegent = player.seat === gameState?.regent_seat;
    const isChambellan = player.seat === gameState?.nominee_seat;
    const isActive = isRegent || isChambellan;

    return (
      <div key={player.id} className={`player-seat ${isActive ? 'player-active' : ''} ${!player.alive ? 'player-dead' : ''}`}>
        <div className="player-name">
          {player.name}
          {isCurrentPlayer && ' (Vous)'}
          
          {/* Role indicators */}
          {isRegent && (
            <div className="role-indicator role-regent" title="Régent">
              👑
            </div>
          )}
          {isChambellan && (
            <div className="role-indicator role-chambellan" title="Chambellan">
              🏛️
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="medieval-room">
        <div className="flex items-center justify-center min-h-screen">
          <Card className="bg-amber-50/95 backdrop-blur-sm border-amber-200 shadow-xl p-8">
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
      <div className="medieval-room">
        <div className="flex items-center justify-center min-h-screen">
          <Card className="bg-red-50/95 backdrop-blur-sm border-red-200 shadow-xl p-8">
            <div className="text-center">
              <p className="text-red-800 text-lg mb-4 font-cinzel">Erreur de connexion au château</p>
              <p className="text-red-600 text-sm font-fell">{error}</p>
              <Button 
                onClick={() => window.location.reload()} 
                className="mt-4 bg-red-600 hover:bg-red-700 font-cinzel"
              >
                Reconnecter
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  const currentPlayer = getCurrentPlayer();
  const roleInfo = getRoleInfo(playerRole);

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
      
      {/* Game Info Parchment */}
      <div className="game-info-parchment">
        <h3 className="font-cinzel text-lg font-bold text-amber-900 mb-3">
          État du Royaume
        </h3>
        
        {/* Your Role */}
        <div className="mb-4">
          <h4 className="font-cinzel font-semibold text-amber-800 mb-2">Votre rôle :</h4>
          <div className="flex items-center space-x-2">
            <span className="text-lg">{roleInfo.icon}</span>
            <span className={`font-fell ${roleInfo.color}`}>{roleInfo.name}</span>
          </div>
        </div>

        {/* Phase Info */}
        <div className="mb-4">
          <h4 className="font-cinzel font-semibold text-amber-800 mb-2">Phase actuelle :</h4>
          <p className="font-fell text-amber-700">{gameState.phase}</p>
        </div>
        
        {/* Tracks */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="font-fell text-blue-700">🛡️ Décrets Loyaux</span>
            <span className="font-cinzel font-bold">{gameState.tracks?.loyal || 0}/5</span>
          </div>
          <div className="flex justify-between">
            <span className="font-fell text-red-700">⚔️ Décrets Conjurés</span>
            <span className="font-cinzel font-bold">{gameState.tracks?.conjure || 0}/6</span>
          </div>
          <div className="flex justify-between">
            <span className="font-fell text-gray-700">⚡ Crise</span>
            <span className="font-cinzel font-bold">{gameState.tracks?.crisis || 0}/3</span>
          </div>
        </div>
      </div>

      {/* Main Round Table - Using the new SVG component */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
        <MedievalTable 
          players={gameState.players?.map(player => ({
            seat: player.seat,
            name: player.name + (player.id === currentPlayerId ? ' (Vous)' : ''),
            active: player.seat === gameState.regent_seat || player.seat === gameState.nominee_seat
          })) || []}
          size={600}
        />
      </div>

      {/* Chat Parchment */}
      <div className="chat-parchment">
        <h3 className="font-cinzel text-lg font-bold text-amber-900 mb-3">
          Parchemin des Délibérations
        </h3>
        
        <ScrollArea className="flex-1 mb-3 pr-2">
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
          </div>
        </ScrollArea>
        
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
      </div>

      {/* Action Area - Bottom Center */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
        {/* Phase-specific actions rendered as wax seals */}
        {gameState.phase === 'NOMINATION' && currentPlayer?.seat === gameState.regent_seat && (
          <div className="text-center">
            <p className="text-yellow-300 font-cinzel mb-4">Choisissez votre Chambellan</p>
            {/* This would integrate with NominationPanel logic */}
          </div>
        )}

        {gameState.phase === 'VOTE' && currentPlayer?.seat !== gameState.regent_seat && currentPlayer?.seat !== gameState.nominee_seat && (
          <div className="flex space-x-4">
            <button 
              className="action-seal approve"
              onClick={() => {/* Handle approve vote */}}
            >
              <div>OUI</div>
            </button>
            <button 
              className="action-seal reject"
              onClick={() => {/* Handle reject vote */}}
            >
              <div>NON</div>
            </button>
          </div>
        )}

        {(gameState.phase === 'LEGIS_REGENT' || gameState.phase === 'LEGIS_CHAMBELLAN') && (
          <div className="text-center">
            <p className="text-yellow-300 font-cinzel mb-4">Session législative en cours...</p>
            {/* This would show legislative cards */}
          </div>
        )}
      </div>
    </div>
  );
};

export default MedievalGameRoom;
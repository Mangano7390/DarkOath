import React, { useState, useEffect, useRef } from 'react';
import { Crown, Sword, Shield, Users, Clock, Vote, Gavel, Eye, Skull, Send, MessageCircle, Zap, Volume2, VolumeX } from 'lucide-react';
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
import ConseilRoyaumePanel from './ConseilRoyaumePanel';
import DefiancePanel from './DefiancePanel';
import MedievalTable from './MedievalTable.js';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Get role display info
const getRoleInfo = (role) => {
  switch(role) {
    case 'LOYAL':
      return {
        name: 'Fidèle',
        color: 'blue',
        icon: Shield,
        description: 'Défendez la Couronne et démasquez les traîtres'
      };
    case 'CONJURE':
      return {
        name: 'Traître',
        color: 'red',
        icon: Sword,
        description: 'Répandez le chaos et aidez le Tyran'
      };
    case 'USURPATEUR':
      return {
        name: 'Tyran',
        color: 'purple',
        icon: Crown,
        description: 'Prenez le pouvoir en secret'
      };
    default:
      return { name: 'Inconnu', color: 'gray', icon: Users, description: '' };
  }
};

// Format phase names to remove underscores and make them readable
const formatPhaseName = (phase) => {
  switch(phase) {
    case 'NOMINATION':
      return 'Nomination';
    case 'VOTE':
      return 'Vote';
    case 'LEGIS_REGENT':
      return 'Législatif Roi';
    case 'LEGIS_CHAMBELLAN':
      return 'Législatif Conseiller';
    case 'CONSEIL_ROYAUME':
      return 'Conseil du Royaume';
    case 'DEFIANCE':
      return 'Piste de Défiance';
    default:
      return phase.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  }
};

// Track Component — dark atmospheric style with clear progress
const TrackComponent = ({ title, current, max, variant }) => {
  const variants = {
    fidele:  { accent: '#3b82f6', glow: 'rgba(59, 130, 246, 0.4)', icon: '🛡️', tag: 'Fidèles',  goal: 'Victoire' },
    traitre: { accent: '#dc2626', glow: 'rgba(220, 38, 38, 0.4)',  icon: '⚔️', tag: 'Trahison', goal: 'Victoire' },
    crise:   { accent: '#f59e0b', glow: 'rgba(245, 158, 11, 0.4)', icon: '⚡', tag: 'Crise',    goal: 'Adoption auto' },
  };
  const v = variants[variant];

  return (
    <div className="darkoath-panel rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="font-bold uppercase tracking-widest text-sm" style={{ fontFamily: "'Cinzel', serif", color: v.accent, textShadow: `0 0 8px ${v.glow}` }}>
          {v.icon} {title}
        </span>
        <span className="text-xs font-bold" style={{ color: v.accent }}>{current}/{max}</span>
      </div>
      <div className="flex space-x-1.5 mb-2">
        {Array.from({ length: max }, (_, i) => {
          const filled = i < current;
          return (
            <div
              key={i}
              className="flex-1 h-9 rounded flex items-center justify-center transition-all"
              style={{
                background: filled
                  ? `linear-gradient(180deg, ${v.accent}, ${v.accent}88)`
                  : 'rgba(20, 14, 8, 0.6)',
                border: `1px solid ${filled ? v.accent : 'rgba(199, 168, 105, 0.2)'}`,
                boxShadow: filled ? `0 0 10px ${v.glow}, inset 0 1px 0 rgba(255,255,255,0.15)` : 'none',
                fontSize: '0.9rem',
                opacity: filled ? 1 : 0.4,
              }}
            >
              {filled ? v.icon : ''}
            </div>
          );
        })}
      </div>
      <div className="text-xs text-center" style={{ color: 'rgba(232, 217, 168, 0.6)', fontFamily: "'IM Fell English', serif", fontStyle: 'italic' }}>
        → {v.goal}
      </div>
    </div>
  );
};

// Player's role card — prominent display with team info
const RoleCard = ({ role, teammates = [], players = [] }) => {
  const info = {
    LOYAL:       { name: 'Fidèle',  icon: '🛡️', color: '#3b82f6', glow: 'rgba(59, 130, 246, 0.5)', bg: 'rgba(30, 58, 138, 0.3)', tagline: 'Défendre la Couronne', desc: 'Démasquez les Traîtres et exécutez le Tyran.' },
    CONJURE:     { name: 'Traître', icon: '⚔️', color: '#dc2626', glow: 'rgba(220, 38, 38, 0.5)',  bg: 'rgba(127, 29, 29, 0.3)', tagline: 'Conspirer dans l\'ombre', desc: 'Sabotez la Couronne et installez le Tyran au pouvoir.' },
    USURPATEUR:  { name: 'Tyran',   icon: '👑', color: '#a855f7', glow: 'rgba(168, 85, 247, 0.5)', bg: 'rgba(88, 28, 135, 0.3)', tagline: 'Régner par le chaos', desc: 'Faites-vous élire Conseiller après 3 Décrets de Trahison.' },
  }[role] || null;

  if (!info) return null;

  const teammateRoleLabel = (r) => r === 'USURPATEUR' ? 'Tyran' : r === 'CONJURE' ? 'Traître' : 'Fidèle';

  return (
    <div className="rounded-lg p-4" style={{
      background: `linear-gradient(180deg, ${info.bg}, rgba(10, 6, 4, 0.9))`,
      border: `2px solid ${info.color}`,
      boxShadow: `0 0 20px ${info.glow}, inset 0 1px 0 rgba(255,255,255,0.08)`,
    }}>
      <div className="text-center mb-3">
        <div className="text-xs uppercase tracking-widest mb-1" style={{ color: 'rgba(232, 217, 168, 0.7)', fontFamily: "'Cinzel', serif" }}>
          Votre Rôle
        </div>
        <div className="text-5xl mb-1" style={{ filter: `drop-shadow(0 0 12px ${info.glow})` }}>
          {info.icon}
        </div>
        <div className="text-2xl font-bold" style={{ fontFamily: "'Cinzel', serif", color: info.color, letterSpacing: '0.15em', textShadow: `0 0 10px ${info.glow}` }}>
          {info.name.toUpperCase()}
        </div>
        <div className="text-sm italic mt-1" style={{ color: 'rgba(232, 217, 168, 0.85)', fontFamily: "'IM Fell English', serif" }}>
          {info.tagline}
        </div>
      </div>
      <div className="text-xs text-center px-2 pb-2" style={{ color: 'rgba(232, 217, 168, 0.75)', lineHeight: 1.5 }}>
        {info.desc}
      </div>

      {teammates.length > 0 && (
        <div className="pt-3 mt-2 border-t" style={{ borderColor: 'rgba(199, 168, 105, 0.25)' }}>
          <div className="text-xs uppercase tracking-widest text-center mb-2" style={{ color: 'rgba(232, 217, 168, 0.75)', fontFamily: "'Cinzel', serif" }}>
            🗡️ Vos Complices
          </div>
          <div className="space-y-1.5">
            {teammates.map((t) => (
              <div key={t.seat} className="flex items-center justify-between px-3 py-1.5 rounded" style={{
                background: 'rgba(0, 0, 0, 0.4)',
                border: `1px solid ${t.role === 'USURPATEUR' ? '#a855f7' : '#dc2626'}`,
              }}>
                <span className="text-sm font-medium" style={{ color: '#e8d9a8' }}>
                  {t.role === 'USURPATEUR' ? '👑' : '⚔️'} {t.name}
                </span>
                <span className="text-xs" style={{ color: t.role === 'USURPATEUR' ? '#a855f7' : '#dc2626' }}>
                  {teammateRoleLabel(t.role)} · S{t.seat}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {role === 'USURPATEUR' && teammates.length === 0 && (
        <div className="pt-3 mt-2 border-t" style={{ borderColor: 'rgba(168, 85, 247, 0.25)' }}>
          <div className="text-xs uppercase tracking-widest text-center mb-2" style={{ color: 'rgba(232, 217, 168, 0.75)', fontFamily: "'Cinzel', serif" }}>
            🕯️ Dans l'ombre
          </div>
          <div className="text-xs text-center italic px-3 py-2 rounded" style={{
            background: 'rgba(0, 0, 0, 0.4)',
            border: '1px solid rgba(168, 85, 247, 0.35)',
            color: 'rgba(232, 217, 168, 0.8)',
            fontFamily: "'IM Fell English', serif",
            lineHeight: 1.5,
          }}>
            Vous ignorez l'identité de vos alliés comme de vos ennemis.<br/>
            Les Traîtres vous connaissent — à eux de vous faire élire Conseiller.
          </div>
        </div>
      )}
    </div>
  );
};

// Conseil du Royaume countdown (30s)
const ConseilCountdown = ({ startTime }) => {
  const [timeLeft, setTimeLeft] = useState(30);
  useEffect(() => {
    if (!startTime) return;
    const tick = () => {
      const elapsed = Date.now() / 1000 - startTime;
      setTimeLeft(Math.max(0, Math.ceil(30 - elapsed)));
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [startTime]);

  const urgent = timeLeft <= 10;
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm" style={{
      background: urgent ? 'rgba(127, 29, 29, 0.7)' : 'rgba(120, 53, 15, 0.6)',
      border: `1px solid ${urgent ? '#dc2626' : '#c7a869'}`,
      color: urgent ? '#fecaca' : '#e8d9a8',
      boxShadow: urgent ? '0 0 12px rgba(220, 38, 38, 0.5)' : '0 0 8px rgba(199, 168, 105, 0.3)',
      animation: urgent ? 'pulse 1s infinite' : 'none',
    }}>
      <Clock className="h-4 w-4" />
      <span className="uppercase tracking-wider text-xs opacity-80" style={{ fontFamily: "'Cinzel', serif" }}>Conseil</span>
      <span className="font-bold text-base tabular-nums">{timeLeft}s</span>
    </div>
  );
};

// Current government indicator
const GovernmentBadge = ({ label, icon, seat, players, color }) => {
  const player = players.find(p => p.seat === seat);
  if (!player) return null;
  return (
    <div className="flex items-center space-x-2 px-3 py-1.5 rounded-full text-sm" style={{
      background: 'rgba(20, 14, 8, 0.7)',
      border: `1px solid ${color}`,
      color: '#e8d9a8',
    }}>
      <span>{icon}</span>
      <span className="uppercase tracking-wider text-xs opacity-80" style={{ fontFamily: "'Cinzel', serif" }}>{label}</span>
      <span className="font-semibold">{player.name}</span>
    </div>
  );
};

// Music control: toggle + volume slider (expandable)
const MusicControl = ({ enabled, volume, onToggle, onVolume }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      className="flex items-center gap-2 px-2 py-1.5 rounded-full"
      style={{
        background: 'rgba(20, 14, 8, 0.7)',
        border: '1px solid rgba(199, 168, 105, 0.4)',
      }}
    >
      <button
        onClick={onToggle}
        className="flex items-center justify-center rounded-full transition-colors"
        style={{ width: 28, height: 28, color: enabled ? '#e8d9a8' : '#8a6d3a' }}
        title={enabled ? 'Couper la musique' : 'Activer la musique'}
        aria-label={enabled ? 'Couper la musique' : 'Activer la musique'}
      >
        {enabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
      </button>
      <button
        onClick={() => setExpanded(v => !v)}
        className="text-[10px] uppercase tracking-widest opacity-70 hover:opacity-100"
        style={{ color: '#e8d9a8', fontFamily: "'Cinzel', serif" }}
        aria-label="Régler le volume"
      >
        Musique
      </button>
      {expanded && (
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={volume}
          onChange={(e) => onVolume(parseFloat(e.target.value))}
          className="w-20 accent-amber-500"
          aria-label="Volume de la musique"
        />
      )}
    </div>
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
  const [showPeoplesAnger, setShowPeoplesAnger] = useState(false);
  const [defianceBanner, setDefianceBanner] = useState(null); // 'opening' | 'marked' | null
  const prevPhaseRef = useRef(null);
  const prevMarkedRef = useRef(null);
  
  // Chat state variables
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  
  const currentPlayerId = localStorage.getItem('userId');
  const currentPlayerName = localStorage.getItem('playerName') || 'Joueur';
  
  // Multiplayer game music - Morceau 2
  const musicRef = useRef(null);
  const [musicEnabled, setMusicEnabled] = useState(() => {
    const saved = localStorage.getItem('darkoath_music_enabled');
    return saved === null ? true : saved === 'true';
  });
  const [musicVolume, setMusicVolume] = useState(() => {
    const saved = localStorage.getItem('darkoath_music_volume');
    return saved === null ? 0.2 : parseFloat(saved);
  });

  useEffect(() => {
    const audio = new Audio('https://customer-assets.emergentagent.com/job_1a735b74-0d1b-4cfc-aa0c-5d6b585ff99b/artifacts/249imtyo_Morceau%202.mp3');
    audio.loop = true;
    audio.volume = musicVolume;
    // iOS Safari: required to play inline without going fullscreen, and
    // to behave correctly when the page has media permissions.
    audio.playsInline = true;
    audio.setAttribute('playsinline', '');
    audio.setAttribute('webkit-playsinline', '');
    audio.preload = 'auto';
    musicRef.current = audio;

    let started = false;
    const tryPlay = () => {
      if (started) return;
      const el = musicRef.current;
      if (!el) return;
      if (!musicEnabledRef.current) return;
      const p = el.play();
      if (p && typeof p.then === 'function') {
        p.then(() => { started = true; }).catch(() => {
          // Autoplay blocked — will retry on next user gesture.
        });
      } else {
        started = true;
      }
    };

    // Attempt immediate play (works on desktop; usually blocked on iOS).
    if (musicEnabled) tryPlay();

    // iOS: retry on the FIRST user gesture anywhere in the app.
    const onGesture = () => {
      tryPlay();
      if (started) {
        document.removeEventListener('touchend', onGesture, true);
        document.removeEventListener('click', onGesture, true);
        document.removeEventListener('keydown', onGesture, true);
      }
    };
    document.addEventListener('touchend', onGesture, true);
    document.addEventListener('click', onGesture, true);
    document.addEventListener('keydown', onGesture, true);

    return () => {
      try { audio.pause(); } catch {}
      document.removeEventListener('touchend', onGesture, true);
      document.removeEventListener('click', onGesture, true);
      document.removeEventListener('keydown', onGesture, true);
      musicRef.current = null;
    };
  }, []);

  // Mirror musicEnabled into a ref so the one-shot gesture handler sees the
  // latest value without having to re-register every toggle.
  const musicEnabledRef = useRef(musicEnabled);
  useEffect(() => { musicEnabledRef.current = musicEnabled; }, [musicEnabled]);

  useEffect(() => {
    if (!musicRef.current) return;
    musicRef.current.volume = musicVolume;
    localStorage.setItem('darkoath_music_volume', String(musicVolume));
  }, [musicVolume]);

  useEffect(() => {
    const el = musicRef.current;
    if (!el) return;
    if (musicEnabled) {
      // User explicitly enabled music — this click IS a user gesture, so
      // play() should succeed on iOS even if autoplay was blocked earlier.
      const p = el.play();
      if (p && typeof p.catch === 'function') p.catch(console.error);
    } else {
      try { el.pause(); } catch {}
    }
    localStorage.setItem('darkoath_music_enabled', String(musicEnabled));
  }, [musicEnabled]);
  
  // Detect "Colère du Peuple" trigger
  useEffect(() => {
    if (gameState?.peoples_anger_triggered) {
      setShowPeoplesAnger(true);
      // Auto-hide after 5 seconds
      const timer = setTimeout(() => {
        setShowPeoplesAnger(false);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [gameState?.peoples_anger_triggered]);

  // Detect phase transitions for Piste de Défiance banners
  useEffect(() => {
    const phase = gameState?.phase;
    const prevPhase = prevPhaseRef.current;
    const marked = gameState?.marked_player_seat || null;
    const prevMarked = prevMarkedRef.current;

    // Entering DEFIANCE from CONSEIL_ROYAUME → "Le Conseil s'achève"
    if (prevPhase === 'CONSEIL_ROYAUME' && phase === 'DEFIANCE') {
      setDefianceBanner('opening');
      const t = setTimeout(() => setDefianceBanner((b) => (b === 'opening' ? null : b)), 2500);
      prevPhaseRef.current = phase;
      prevMarkedRef.current = marked;
      return () => clearTimeout(t);
    }

    // A new mark was just set (after DEFIANCE resolution)
    if (prevPhase === 'DEFIANCE' && phase === 'NOMINATION' && marked && marked !== prevMarked) {
      setDefianceBanner('marked');
      const t = setTimeout(() => setDefianceBanner((b) => (b === 'marked' ? null : b)), 3500);
      prevPhaseRef.current = phase;
      prevMarkedRef.current = marked;
      return () => clearTimeout(t);
    }

    prevPhaseRef.current = phase;
    prevMarkedRef.current = marked;
  }, [gameState?.phase, gameState?.marked_player_seat]);
  
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
  
  // Handle speak toggle for Conseil du Royaume
  const handleSpeakToggle = async () => {
    try {
      await axios.post(`${API}/rooms/${roomCode}/action?player_id=${currentPlayerId}&action_type=SPEAK_TOGGLE`, {});
      console.log('Speak toggle successful');
    } catch (error) {
      console.error('Speak toggle failed:', error);
      alert('Erreur lors du toggle vocal: ' + (error.response?.data?.detail || error.message));
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
    <div className="min-h-screen darkoath-game text-gray-100 relative" style={{ minHeight: '100dvh' }}>
      {/* Piste de Défiance banners */}
      {defianceBanner && (
        <div className="fixed inset-0 pointer-events-none flex items-center justify-center z-40">
          <div
            className="px-6 py-4 rounded-lg text-center"
            style={{
              background: defianceBanner === 'marked' ? 'rgba(127, 29, 29, 0.92)' : 'rgba(20, 14, 8, 0.92)',
              border: `2px solid ${defianceBanner === 'marked' ? '#dc2626' : '#c7a869'}`,
              boxShadow: '0 0 30px rgba(0,0,0,0.8)',
              maxWidth: '90vw',
              animation: 'fadeIn 0.3s ease-out',
            }}
          >
            {defianceBanner === 'opening' && (
              <>
                <p
                  className="text-xl md:text-2xl"
                  style={{ color: '#e8d9a8', fontFamily: "'Cinzel', serif", letterSpacing: '0.12em' }}
                >
                  🕯️ Le Conseil s'achève
                </p>
                <p className="text-sm text-amber-100/70 italic mt-1">Désignez un suspect — le peuple observe…</p>
              </>
            )}
            {defianceBanner === 'marked' && (() => {
              const markedPlayer = (gameState?.players || []).find(
                (p) => p.seat === gameState?.marked_player_seat
              );
              return (
                <>
                  <p
                    className="text-xl md:text-2xl"
                    style={{ color: '#fecaca', fontFamily: "'Cinzel', serif", letterSpacing: '0.12em' }}
                  >
                    ⚠ Un joueur est marqué
                  </p>
                  <p className="text-sm text-red-200 mt-1">
                    <strong>{markedPlayer?.name || `Siège ${gameState?.marked_player_seat}`}</strong>
                    {' '}ne peut être ni Roi ni Conseiller ce tour-ci.
                  </p>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Colère du Peuple Message */}
      {showPeoplesAnger && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <Card className="bg-red-900 border-red-700 shadow-2xl max-w-md mx-4">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl text-red-100 flex items-center justify-center space-x-2">
                <Zap className="h-8 w-8 text-yellow-400" />
                <span>Colère du Peuple</span>
                <Zap className="h-8 w-8 text-yellow-400" />
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-red-200 text-lg mb-4">
                ⚡ Un décret est imposé et le Roi est désavoué !
              </p>
              <p className="text-red-300 text-sm">
                Le Roi désavoué ne peut plus être élu au tour suivant.
              </p>
              <Button 
                onClick={() => setShowPeoplesAnger(false)}
                className="mt-4 bg-red-600 hover:bg-red-700 text-white"
              >
                Compris
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Header Bar */}
      <div className="darkoath-header px-4 py-3 relative z-10">
        <div className="flex items-center justify-between max-w-7xl mx-auto gap-3 flex-wrap">
          <div className="flex items-center space-x-3">
            <h1 className="text-xl font-bold text-amber-400" style={{ fontFamily: "'Cinzel', serif", letterSpacing: '0.15em' }}>DARK OATH</h1>
            <Badge className="bg-amber-600 text-black">{roomCode}</Badge>
            <span className="px-3 py-1 rounded text-xs uppercase tracking-widest" style={{
              background: 'rgba(199, 168, 105, 0.15)',
              border: '1px solid rgba(199, 168, 105, 0.4)',
              color: '#e8d9a8',
              fontFamily: "'Cinzel', serif",
            }}>
              {formatPhaseName(gameState.phase)}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {gameState.phase === 'CONSEIL_ROYAUME' && gameState.conseil_royaume_start_time && (
              <ConseilCountdown startTime={gameState.conseil_royaume_start_time} />
            )}
            {gameState.regent_seat && (
              <GovernmentBadge
                label="Roi"
                icon="👑"
                seat={gameState.regent_seat}
                players={gameState.players || []}
                color="#c7a869"
              />
            )}
            {gameState.nominee_seat && (gameState.phase === 'VOTE' || gameState.phase === 'LEGIS_CHAMBELLAN') && (
              <GovernmentBadge
                label="Conseiller"
                icon="🗝️"
                seat={gameState.nominee_seat}
                players={gameState.players || []}
                color="#8a6d3a"
              />
            )}

            <MusicControl
              enabled={musicEnabled}
              volume={musicVolume}
              onToggle={() => setMusicEnabled(v => !v)}
              onVolume={setMusicVolume}
            />
          </div>
        </div>
      </div>

      {/* DESKTOP LAYOUT (≥1024px) */}
      <div className="hidden lg:flex h-full" style={{ height: 'calc(100dvh - 73px)' }}>
        
        {/* Left Column — Your Role + Tracks */}
        <div className="w-80 p-4 space-y-4 darkoath-sidebar border-r relative z-10 overflow-y-auto">
          {playerRole && (
            <RoleCard
              role={playerRole}
              teammates={gameState.teammates || []}
              players={gameState.players || []}
            />
          )}

          <div className="space-y-3">
            <TrackComponent
              title="Fidèles"
              current={gameState.tracks?.loyal || 0}
              max={5}
              variant="fidele"
            />
            <TrackComponent
              title="Trahison"
              current={gameState.tracks?.conjure || 0}
              max={6}
              variant="traitre"
            />
            <TrackComponent
              title="Crise"
              current={gameState.tracks?.crisis || 0}
              max={3}
              variant="crise"
            />
          </div>
        </div>

        {/* Center Column - Table */}
        <div className="flex-1 flex flex-col items-center justify-center p-4 darkoath-table-stage relative z-10">
          <div className="w-full max-w-md">
            <MedievalTable
              players={gameState.players?.map(player => ({
                id: player.id,
                seat: player.seat,
                name: player.name + (player.id === currentPlayerId ? ' (Vous)' : ''),
                alive: player.alive,
              })) || []}
              size={360}
              disgracedPlayerSeat={gameState.disgraced_player_seat}
              speakingPlayers={gameState.speaking_players || []}
              regentSeat={gameState.regent_seat}
              nomineeSeat={gameState.nominee_seat}
              votedPlayerIds={Object.keys(gameState.votes || {})}
              phase={gameState.phase}
            />
          </div>
        </div>

        {/* Right Column - Chat + Actions */}
        <div className="w-80 p-4 flex flex-col space-y-4 darkoath-sidebar border-l relative z-10">
          
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
              <CardTitle className="text-lg text-gray-100">Actions - {
                formatPhaseName(gameState.phase)
              }</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Phase-specific actions */}
              {gameState.phase === 'NOMINATION' && (
                <NominationPanel
                  meSeat={gameState.players?.find(p => p.id === currentPlayerId)?.seat}
                  regentSeat={gameState.regent_seat}
                  players={gameState.players || []}
                  prevGovernment={gameState.prev_government}
                  disgracedPlayerSeat={gameState.disgraced_player_seat}
                  markedPlayerSeat={gameState.marked_player_seat}
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

              {gameState.phase === 'DEFIANCE' && (
                <DefiancePanel
                  gameState={gameState}
                  currentPlayerId={currentPlayerId}
                  onVote={async (targetSeat) => {
                    try {
                      await axios.post(
                        `${API}/rooms/${roomCode}/action?player_id=${currentPlayerId}&action_type=DEFIANCE_VOTE`,
                        { targetSeat }
                      );
                    } catch (error) {
                      alert('Erreur lors du vote de défiance: ' + (error.response?.data?.detail || error.message));
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

              {gameState.status === 'in_progress' && (
                <ConseilRoyaumePanel
                  gameState={gameState}
                  roomCode={roomCode}
                  currentPlayerId={currentPlayerId}
                  onSpeakToggle={handleSpeakToggle}
                  speakingPlayers={gameState.speaking_players || []}
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

              {!['NOMINATION', 'VOTE', 'LEGIS_REGENT', 'LEGIS_CHAMBELLAN', 'CONSEIL_ROYAUME'].includes(gameState.phase) && (
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
                  <CardTitle className="text-lg text-gray-100">Actions - {
                    formatPhaseName(gameState.phase)
                  }</CardTitle>
                </CardHeader>
                <CardContent>
                  {gameState.phase === 'NOMINATION' && (
                    <NominationPanel
                      meSeat={gameState.players?.find(p => p.id === currentPlayerId)?.seat}
                      regentSeat={gameState.regent_seat}
                      players={gameState.players || []}
                      prevGovernment={gameState.prev_government}
                      disgracedPlayerSeat={gameState.disgraced_player_seat}
                      markedPlayerSeat={gameState.marked_player_seat}
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

                  {gameState.phase === 'DEFIANCE' && (
                    <DefiancePanel
                      gameState={gameState}
                      currentPlayerId={currentPlayerId}
                      onVote={async (targetSeat) => {
                        try {
                          await axios.post(
                            `${API}/rooms/${roomCode}/action?player_id=${currentPlayerId}&action_type=DEFIANCE_VOTE`,
                            { targetSeat }
                          );
                        } catch (error) {
                          alert('Erreur lors du vote de défiance: ' + (error.response?.data?.detail || error.message));
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

                  {gameState.status === 'in_progress' && (
                    <ConseilRoyaumePanel
                      gameState={gameState}
                      roomCode={roomCode}
                      currentPlayerId={currentPlayerId}
                      onSpeakToggle={handleSpeakToggle}
                      speakingPlayers={gameState.speaking_players || []}
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

                  {!['NOMINATION', 'VOTE', 'LEGIS_REGENT', 'LEGIS_CHAMBELLAN', 'CONSEIL_ROYAUME'].includes(gameState.phase) && (
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
                    id: player.id,
                    seat: player.seat,
                    name: player.name.length > 8 ? player.name.substring(0, 8) + '...' : player.name,
                    alive: player.alive,
                  })) || []}
                  size={240}
                  disgracedPlayerSeat={gameState.disgraced_player_seat}
                  speakingPlayers={gameState.speaking_players || []}
                  regentSeat={gameState.regent_seat}
                  nomineeSeat={gameState.nominee_seat}
                  votedPlayerIds={Object.keys(gameState.votes || {})}
                  phase={gameState.phase}
                />
              </div>
            </div>
          )}

          {/* Tracks Tab */}
          {mobileTab === 'tracks' && (
            <div className="space-y-4">
              {playerRole && (
                <RoleCard
                  role={playerRole}
                  teammates={gameState.teammates || []}
                  players={gameState.players || []}
                />
              )}
              <TrackComponent title="Fidèles"  current={gameState.tracks?.loyal   || 0} max={5} variant="fidele" />
              <TrackComponent title="Trahison" current={gameState.tracks?.conjure || 0} max={6} variant="traitre" />
              <TrackComponent title="Crise"    current={gameState.tracks?.crisis  || 0} max={3} variant="crise" />
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
              🎭 Rôle
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
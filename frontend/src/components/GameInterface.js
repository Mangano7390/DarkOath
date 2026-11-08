import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Crown, Sword, Shield, Users, Clock, Vote, Gavel, Eye, Skull, Send, MessageCircle, Zap, Volume2, VolumeX } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import axios from 'axios';
import NominationPanel from './NominationPanel';
import VotePanel from './VotePanel';
import LegislativePanel from './LegislativePanel';
import ConseilRoyaumePanel from './ConseilRoyaumePanel';
import DefiancePanel from './DefiancePanel';
import PowerPanel from './PowerPanel';
import { IdentityBar, TurnSteps, CourtTable, useMedia } from './ThroneRoom';
import { RevealOverlay, Chronicle, TurnHint, MiniTracks, ConseilReady, SpectatorNotice, useIsDesktop, playCue } from './GameExtras';
import { errorMessage, rememberRoom, forgetRoom, syncServerClock, serverNow, powerMarks, powerLegend } from '../lib/game';

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
    case 'POWER':
      return 'Pouvoir du Roi';
    case 'ENDGAME':
      return 'Fin de partie';
    default:
      return phase.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  }
};

// Track Component — dark atmospheric style with clear progress
const TrackComponent = ({ title, current, max, variant, powerBoard }) => {
  const variants = {
    fidele:  { accent: '#3b82f6', glow: 'rgba(59, 130, 246, 0.4)', icon: '🛡️', tag: 'Fidèles',  goal: 'Victoire' },
    traitre: { accent: '#dc2626', glow: 'rgba(220, 38, 38, 0.4)',  icon: '⚔️', tag: 'Trahison', goal: 'Victoire' },
    crise:   { accent: '#f59e0b', glow: 'rgba(245, 158, 11, 0.4)', icon: '⚡', tag: 'Crise',    goal: 'Adoption auto' },
  };
  const v = variants[variant];
  // Powers shown on empty slots (they depend on the number of players)
  const slotMarks = variant === 'traitre' ? powerMarks(powerBoard) : variant === 'fidele' ? { 5: '🏆' } : variant === 'crise' ? { 3: '⚡' } : {};

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
              {filled ? v.icon : (slotMarks[i + 1] || '')}
            </div>
          );
        })}
      </div>
      <div className="text-xs text-center" style={{ color: 'rgba(232, 217, 168, 0.6)', fontFamily: "'IM Fell English', serif", fontStyle: 'italic' }}>
        {variant === 'traitre' ? `${powerLegend(powerBoard)} · dès 3 : Tyran élu Conseiller = victoire des Traîtres · 5 : veto` : `→ ${v.goal}`}
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

// End-of-game banner: big camp reveal with reason + role list.
const EndgameBanner = ({ gameState, currentPlayerId, isHost = false, pending = false, onRestart, onHome }) => {
  const winner = gameState?.winner;
  const reason = gameState?.winner_reason;
  const tracks = gameState?.tracks || {};
  const players = gameState?.players || [];

  // Normalise winner strings ("LOYAUX" / "FIDELES" are both Fidèles camp)
  const fidelesWon = winner === 'LOYAUX' || winner === 'FIDELES';
  const conjuresWon = winner === 'CONJURES';

  const reasonText = (() => {
    switch (reason) {
      case '5_loyal':
        return 'Cinq Décrets Loyaux ont été promulgués. La Couronne tient bon.';
      case 'tyran_executed':
        return 'Le Tyran a été démasqué et exécuté. Son règne prend fin.';
      case '6_conjure':
        return 'Six Décrets de Trahison ont corrompu le royaume. Les ombres ont triomphé.';
      case 'tyran_elected':
        return 'Le Tyran a été élu Conseiller après trois Trahisons. Le trône est tombé.';
      default:
        return fidelesWon
          ? 'Les Fidèles ont déjoué la conspiration.'
          : conjuresWon
            ? 'La conspiration a renversé la Couronne.'
            : 'La partie est terminée.';
    }
  })();

  const camp = fidelesWon
    ? { label: 'LES FIDÈLES', color: '#3b82f6', glow: 'rgba(59, 130, 246, 0.55)', Icon: Shield, sub: 'La Couronne est sauvée' }
    : conjuresWon
      ? { label: 'LES TRAÎTRES', color: '#dc2626', glow: 'rgba(220, 38, 38, 0.55)', Icon: Sword, sub: 'Les ombres ont gagné' }
      : { label: 'FIN DE PARTIE', color: '#c7a869', glow: 'rgba(199, 168, 105, 0.4)', Icon: Crown, sub: '' };

  const CampIcon = camp.Icon;

  // Roles reveal so players see who was who
  const rolesReveal = players.map((p) => {
    let label = '';
    if (p.role === 'LOYAL') label = 'Fidèle';
    else if (p.role === 'CONJURE') label = 'Traître';
    else if (p.role === 'USURPATEUR') label = 'Tyran';
    else label = '—';
    return { ...p, _label: label };
  });

  return (
    <div className="space-y-4">
      <div
        className="p-6 rounded-lg text-center"
        style={{
          background: `linear-gradient(180deg, rgba(20, 14, 8, 0.85), rgba(10, 6, 4, 0.95))`,
          border: `2px solid ${camp.color}`,
          boxShadow: `0 0 28px ${camp.glow}`,
        }}
      >
        <div className="text-[11px] uppercase tracking-widest mb-3" style={{ color: 'rgba(232, 217, 168, 0.7)', fontFamily: "'Cinzel', serif", letterSpacing: '0.2em' }}>
          ✦ Fin de la Partie ✦
        </div>

        <CampIcon
          className="h-16 w-16 mx-auto mb-3"
          style={{ color: camp.color, filter: `drop-shadow(0 0 12px ${camp.glow})` }}
        />

        <div
          className="font-bold mb-1"
          style={{
            color: camp.color,
            fontFamily: "'Cinzel', serif",
            fontSize: 'clamp(1.8rem, 5vw, 2.75rem)',
            letterSpacing: '0.15em',
            textShadow: `0 0 14px ${camp.glow}`,
          }}
        >
          {camp.label}
        </div>
        <div
          className="uppercase tracking-widest text-sm mb-4"
          style={{ color: '#e8d9a8', fontFamily: "'Cinzel', serif", letterSpacing: '0.2em' }}
        >
          ont gagné
        </div>

        <p
          className="text-base md:text-lg mb-2 italic"
          style={{ color: 'rgba(232, 217, 168, 0.9)', fontFamily: "'IM Fell English', serif" }}
        >
          {reasonText}
        </p>
        {camp.sub && (
          <p className="text-sm" style={{ color: 'rgba(232, 217, 168, 0.6)' }}>{camp.sub}</p>
        )}

        {/* Score tracks */}
        <div className="flex items-center justify-center gap-6 mt-5 text-xs">
          <div className="flex items-center gap-2" style={{ color: '#93c5fd' }}>
            <Shield className="h-4 w-4" />
            <span>{tracks.loyal ?? 0} / 5</span>
          </div>
          <div className="flex items-center gap-2" style={{ color: '#fca5a5' }}>
            <Sword className="h-4 w-4" />
            <span>{tracks.conjure ?? 0} / 6</span>
          </div>
        </div>
      </div>

      {/* Roles reveal */}
      <div
        className="p-3 rounded-lg"
        style={{
          background: 'rgba(20, 14, 8, 0.6)',
          border: '1px solid rgba(199, 168, 105, 0.3)',
        }}
      >
        <div className="text-[10px] uppercase tracking-widest mb-2 flex items-center gap-2" style={{ color: 'rgba(232, 217, 168, 0.7)', fontFamily: "'Cinzel', serif" }}>
          <Eye className="h-3.5 w-3.5" /> Révélation des identités
        </div>
        <div className="space-y-1.5">
          {rolesReveal.map((p) => {
            const isFidele = p.role === 'LOYAL';
            const isTyran = p.role === 'USURPATEUR';
            const rowColor = isFidele ? '#93c5fd' : isTyran ? '#d8b4fe' : '#fca5a5';
            const rowBg = isFidele
              ? 'rgba(30, 58, 138, 0.18)'
              : isTyran
                ? 'rgba(88, 28, 135, 0.35)'
                : 'rgba(127, 29, 29, 0.22)';
            const rowBorder = isFidele
              ? 'rgba(59, 130, 246, 0.4)'
              : isTyran
                ? 'rgba(168, 85, 247, 0.6)'
                : 'rgba(220, 38, 38, 0.4)';
            return (
              <div
                key={p.seat}
                className="flex items-center gap-2 p-2 rounded text-sm"
                style={{
                  background: rowBg,
                  border: `1px solid ${rowBorder}`,
                  color: rowColor,
                  fontFamily: "'Cinzel', serif",
                }}
              >
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{
                    background: 'rgba(199, 168, 105, 0.2)',
                    border: '1px solid rgba(199, 168, 105, 0.4)',
                    color: '#e8d9a8',
                  }}
                >
                  {p.seat}
                </div>
                <span className="flex-1 truncate text-amber-100">
                  {p.name}
                  {p.id === currentPlayerId && <span className="opacity-60"> (vous)</span>}
                </span>
                <span className="text-xs uppercase tracking-widest font-semibold">
                  {p._label}
                </span>
                {!p.alive && (
                  <Skull className="h-3.5 w-3.5 opacity-70 flex-shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {isHost ? (
          <Button onClick={onRestart} disabled={pending} className="oath-btn-primary py-5">
            ⚔️ Rejouer
          </Button>
        ) : (
          <div className="text-center text-sm italic py-3" style={{ color: 'rgba(232, 217, 168, 0.75)' }}>
            L'hôte peut relancer une partie…
          </div>
        )}
        <Button onClick={onHome} variant="outline" className="py-5 bg-black/40 border-amber-700/60 text-amber-100 hover:bg-amber-950/50">
          Retour à l'accueil
        </Button>
      </div>
    </div>
  );
};

// Conseil du Royaume countdown (60s — mirror of backend CONSEIL_DURATION)
const CONSEIL_COUNTDOWN_DURATION = 60;
const ConseilCountdown = ({ startTime, duration = CONSEIL_COUNTDOWN_DURATION }) => {
  const [timeLeft, setTimeLeft] = useState(duration);
  useEffect(() => {
    if (!startTime) return;
    const tick = () => {
      const elapsed = serverNow() - startTime;
      setTimeLeft(Math.max(0, Math.ceil(duration - elapsed)));
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [startTime, duration]);

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
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const isWide = useMedia('(min-width: 1440px)');
  const [gameState, setGameState] = useState(null);
  const [playerRole, setPlayerRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [offline, setOffline] = useState(false);
  const [pending, setPending] = useState(false);
  const [mobileTab, setMobileTab] = useState('table'); // 'table', 'tracks', 'chat', 'log'
  const [sideTab, setSideTab] = useState('chat'); // desktop right column: 'chat' | 'log'
  const [unread, setUnread] = useState(0);
  const [showPeoplesAnger, setShowPeoplesAnger] = useState(false);
  const [defianceBanner, setDefianceBanner] = useState(null); // 'opening' | 'marked' | null
  const [executionBanner, setExecutionBanner] = useState(null); // { seat, name } | null
  const prevPhaseRef = useRef(null);
  const prevMarkedRef = useRef(null);
  const prevExecutionRef = useRef(null);

  // Chat state variables
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const chatEndRef = useRef(null);
  const seenMsgCount = useRef(0);

  const currentPlayerId = localStorage.getItem('userId');
  const me = gameState?.players?.find((p) => p.id === currentPlayerId) || null;
  const isHost = !!gameState?.host_id && gameState.host_id === currentPlayerId;

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
    const audio = new Audio('/music/morceau2.mp3');
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
  
  // Endgame sting — plays once when the game transitions into ENDGAME,
  // regardless of which camp wins. Respects the music enabled preference
  // but keeps its own volume so the moment stays audible.
  const endgameAudioRef = useRef(null);
  const endgamePlayedRef = useRef(false);
  useEffect(() => {
    const phase = gameState?.phase;
    if (phase !== 'ENDGAME') {
      // Reset flag if we somehow leave ENDGAME (e.g. new game restart),
      // so a subsequent endgame can fire again.
      endgamePlayedRef.current = false;
      return;
    }
    if (endgamePlayedRef.current) return;
    endgamePlayedRef.current = true;

    const saved = localStorage.getItem('darkoath_music_enabled');
    const enabled = saved === null ? true : saved === 'true';
    if (!enabled) return;

    try {
      const sting = new Audio('/endgame.wav');
      sting.volume = 0.8;
      sting.playsInline = true;
      sting.setAttribute('playsinline', '');
      sting.setAttribute('webkit-playsinline', '');
      endgameAudioRef.current = sting;
      const p = sting.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => {
          // Autoplay blocked — will likely not happen here since the user
          // has already interacted with the game by this point.
        });
      }
    } catch {
      // ignore
    }
  }, [gameState?.phase]);

  // Stop the endgame sting if the component unmounts.
  useEffect(() => {
    return () => {
      const el = endgameAudioRef.current;
      if (el) {
        try { el.pause(); } catch {}
        endgameAudioRef.current = null;
      }
    };
  }, []);

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
    if (prevPhase === 'CONSEIL_ROYAUME' && phase === 'DEFIANCE') {
      setDefianceBanner('opening');
    } else if (prevPhase === 'DEFIANCE' && phase !== 'DEFIANCE' && marked && marked !== prevMarked) {
      setDefianceBanner('marked');
    }
    prevPhaseRef.current = phase;
    prevMarkedRef.current = marked;
  }, [gameState?.phase, gameState?.marked_player_seat]);

  // Auto-hide banners (own effect so frequent re-renders can't cancel the timer)
  useEffect(() => {
    if (!defianceBanner) return undefined;
    const t = setTimeout(() => setDefianceBanner(null), defianceBanner === 'marked' ? 3500 : 2500);
    return () => clearTimeout(t);
  }, [defianceBanner]);

  // Detect execution: show a banner to everyone when a new player is executed
  const executedSeat = gameState?.last_execution_seat || null;
  useEffect(() => {
    const prev = prevExecutionRef.current;
    if (executedSeat && executedSeat !== prev) {
      const victim = (gameState?.players || []).find((p) => p.seat === executedSeat);
      setExecutionBanner({ seat: executedSeat, name: victim?.name || `Siège ${executedSeat}` });
      playCue('death');
    }
    prevExecutionRef.current = executedSeat;
  }, [executedSeat]);

  useEffect(() => {
    if (!executionBanner) return undefined;
    const t = setTimeout(() => setExecutionBanner(null), 4500);
    return () => clearTimeout(t);
  }, [executionBanner]);

  // ------------------------------------------------------------------
  // Server sync
  // ------------------------------------------------------------------
  const loadGameState = useCallback(async () => {
    if (!currentPlayerId) return;
    try {
      const response = await axios.get(`${API}/rooms/${roomCode}/game_state`);
      syncServerClock(response.data.server_time);
      if (response.data.status === 'lobby') {
        // The host started a new game ("Rejouer")
        navigate(`/lobby/${roomCode}`);
        return;
      }
      setGameState(response.data);
      setPlayerRole(response.data.your_role);
      setLoading(false);
      setOffline(false);
      setError(null);
      rememberRoom(roomCode);
    } catch (err) {
      const status = err?.response?.status;
      if (status === 404 || status === 403 || status === 401) {
        forgetRoom();
        setError(status === 404 ? "Cette partie n'existe plus (le serveur a peut-être redémarré)." : "Vous ne faites pas partie de cette partie.");
        setLoading(false);
      } else {
        // Network blip: keep the last good state and show a banner.
        setOffline(true);
      }
    }
  }, [roomCode, currentPlayerId, navigate]);

  useEffect(() => {
    if (!currentPlayerId) {
      navigate(`/?join=${roomCode}`);
      return undefined;
    }
    loadGameState();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') loadGameState();
    }, 1500);
    const onVisible = () => { if (document.visibilityState === 'visible') loadGameState(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [roomCode, currentPlayerId, loadGameState, navigate]);

  // Chat polling
  const loadChat = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/rooms/${roomCode}/chat`);
      setMessages(response.data.messages || []);
    } catch {
      // ignore — the game-state poll reports connectivity problems
    }
  }, [roomCode]);

  useEffect(() => {
    if (!currentPlayerId) return undefined;
    loadChat();
    const id = setInterval(() => { if (document.visibilityState === 'visible') loadChat(); }, 2000);
    return () => clearInterval(id);
  }, [currentPlayerId, loadChat]);

  const chatVisible = isDesktop ? sideTab === 'chat' : mobileTab === 'chat';
  useEffect(() => {
    if (chatVisible) {
      seenMsgCount.current = messages.length;
      setUnread(0);
      chatEndRef.current?.scrollIntoView({ block: 'nearest' });
    } else {
      setUnread(Math.max(0, messages.length - seenMsgCount.current));
    }
  }, [messages.length, chatVisible]);

  // One helper for every game action: pending state, toast on error, instant refresh.
  const act = async (action_type, payload = {}) => {
    if (pending) return false;
    setPending(true);
    try {
      await axios.post(`${API}/rooms/${roomCode}/action`, { action_type, payload });
      await loadGameState();
      return true;
    } catch (err) {
      toast.error(errorMessage(err, "Action impossible."));
      await loadGameState();
      return false;
    } finally {
      setPending(false);
    }
  };

  const sendMessage = async () => {
    const text = newMessage.trim();
    if (!text || isSending) return;
    setIsSending(true);
    try {
      await axios.post(`${API}/rooms/${roomCode}/chat`, { message: text });
      setNewMessage('');
      await loadChat();
    } catch (err) {
      toast.error(errorMessage(err, "Message non envoyé."));
    } finally {
      setIsSending(false);
    }
  };

  const handleSpeakToggle = () => act('SPEAK_TOGGLE');

  if (loading) {
    return (
      <div className="min-h-screen darkoath-game flex items-center justify-center" style={{ minHeight: '100dvh' }}>
        <div className="text-center">
          <div className="animate-spin h-10 w-10 border-4 border-amber-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-amber-100 text-lg" style={{ fontFamily: "'Cinzel', serif" }}>Le Conseil se réunit…</p>
          <p className="text-amber-200/60 text-sm mt-2 tracking-widest">{roomCode}</p>
        </div>
      </div>
    );
  }

  if (error || !gameState) {
    return (
      <div className="min-h-screen darkoath-game flex items-center justify-center p-4" style={{ minHeight: '100dvh' }}>
        <div className="oath-card p-8 text-center max-w-md">
          <p className="text-amber-100 text-xl mb-3" style={{ fontFamily: "'Cinzel', serif" }}>Partie introuvable</p>
          <p className="text-amber-200/70 text-sm mb-6">{error || 'Connexion impossible.'}</p>
          <Button onClick={() => navigate('/')} className="oath-btn-primary px-6">Retour à l'accueil</Button>
        </div>
      </div>
    );
  }

  const phase = gameState.phase;
  const players = gameState.players || [];
  const iAmDead = me && me.alive === false;

  // ------------------------------------------------------------------
  // Shared pieces (rendered once, in either the desktop or the mobile layout)
  // ------------------------------------------------------------------
  // Clicking a player on the table: nomination and the King's powers
  const iAmKing = me?.seat === gameState.regent_seat && me?.alive !== false;
  let selectableSeats = [];
  let selectHint = null;
  if (iAmKing && phase === 'NOMINATION') {
    selectableSeats = gameState.eligible_nominee_seats || [];
    selectHint = 'Cliquez sur votre futur Conseiller';
  } else if (iAmKing && phase === 'POWER' && ['INVESTIGATE', 'EXECUTE', 'SPECIAL_ELECTION'].includes(gameState.active_power)
    && !(gameState.active_power === 'INVESTIGATE' && gameState.power_result)) {
    const done = gameState.investigated_seats || [];
    selectableSeats = players.filter((p) => p.alive && p.seat !== me.seat
      && !(gameState.active_power === 'INVESTIGATE' && done.includes(p.seat))).map((p) => p.seat);
    selectHint = ({ INVESTIGATE: 'Cliquez sur le joueur à sonder', EXECUTE: 'Cliquez sur le joueur à exécuter', SPECIAL_ELECTION: 'Cliquez sur le prochain Roi' })[gameState.active_power];
  }
  const onSeatSelect = (seat) => {
    const name = players.find((p) => p.seat === seat)?.name || `siège ${seat}`;
    if (phase === 'NOMINATION') { act('NOMINATE', { nomineeSeat: seat }); return; }
    if (gameState.active_power === 'EXECUTE' && !window.confirm(`Exécuter ${name} ? Cette action est irréversible.`)) return;
    act(gameState.active_power, { targetSeat: seat });
  };
  const table = (layout) => (
    <CourtTable
      gameState={gameState}
      me={me}
      layout={layout}
      selectableSeats={pending ? [] : selectableSeats}
      onSelect={onSeatSelect}
      selectHint={selectHint}
    />
  );

  const tracks = (
    <div className="space-y-3">
      <TrackComponent title="Fidèles" current={gameState.tracks?.loyal || 0} max={5} variant="fidele" />
      <TrackComponent title="Trahison" current={gameState.tracks?.conjure || 0} max={6} variant="traitre" powerBoard={gameState.power_board} />
      <TrackComponent title="Colère du Peuple" current={gameState.tracks?.crisis || 0} max={3} variant="crise" />
      <div className="text-xs text-center" style={{ color: 'rgba(232,217,168,0.6)' }}>
        📜 Pioche : {gameState.deck_count ?? '—'} · Défausse : {gameState.discard_count ?? '—'}
      </div>
    </div>
  );

  const chat = (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0" role="log" aria-live="polite">
        {messages.length === 0 && (
          <p className="text-xs italic text-amber-200/60 p-2">Le Dark Oath a commencé. Que les conspirations débutent…</p>
        )}
        {messages.map((msg) => {
          const mine = msg.player_id === currentPlayerId;
          return (
            <div key={msg.id} className={`p-2.5 rounded-lg text-sm border ${
              msg.type === 'system'
                ? 'bg-purple-950/70 text-purple-100 border-purple-800'
                : mine
                  ? 'bg-amber-950/70 text-amber-100 border-amber-800'
                  : msg.is_bot
                    ? 'bg-slate-900/80 text-slate-100 border-slate-700'
                    : 'bg-stone-900/80 text-stone-100 border-stone-700'
            }`}>
              <div className="font-semibold text-xs mb-0.5 opacity-80">
                {msg.is_bot ? '🤖 ' : ''}{msg.player_name}
                <span className="opacity-60 ml-2 font-normal">
                  {new Date(msg.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="break-words">{msg.message}</div>
            </div>
          );
        })}
        <div ref={chatEndRef} />
      </div>
      <form
        className="flex gap-2 flex-shrink-0 pt-3"
        onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
      >
        <Input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder={iAmDead ? 'Les morts se taisent…' : 'Chuchotez vos secrets…'}
          aria-label="Message"
          className="flex-1 bg-black/50 border-amber-900/60 text-amber-50 placeholder-amber-200/40"
          maxLength={300}
          disabled={isSending || iAmDead}
        />
        <Button
          type="submit"
          disabled={!newMessage.trim() || isSending || iAmDead}
          className="px-4 bg-amber-600 hover:bg-amber-700 text-black"
          style={{ minHeight: 44, minWidth: 44 }}
          aria-label="Envoyer"
        >
          {isSending ? <div className="animate-spin h-4 w-4 border-2 border-black border-t-transparent rounded-full" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );

  const chronicle = (
    <Chronicle
      className="flex-1"
      events={gameState.events || []}
      investigations={gameState.my_investigations}
      players={players}
    />
  );

  const actions = (
    <div>
      {phase === 'NOMINATION' && (
        <NominationPanel
          meSeat={me?.seat}
          regentSeat={gameState.regent_seat}
          players={players}
          prevGovernment={gameState.prev_government}
          disgracedPlayerSeat={gameState.disgraced_player_seat}
          markedPlayerSeat={gameState.marked_player_seat}
          eligibleSeats={gameState.eligible_nominee_seats}
          pending={pending}
          onNominate={(seat) => act('NOMINATE', { nomineeSeat: seat })}
        />
      )}

      {phase === 'VOTE' && (iAmDead ? <SpectatorNotice /> : (
        <VotePanel
          players={players}
          regentSeat={gameState.regent_seat}
          nomineeSeat={gameState.nominee_seat}
          votesCast={gameState.votes_cast || []}
          myVote={gameState.my_vote}
          mySeat={me?.seat}
          pending={pending}
          onVote={(vote) => act('VOTE', { vote })}
        />
      ))}

      {(phase === 'LEGIS_REGENT' || phase === 'LEGIS_CHAMBELLAN') && (
        <LegislativePanel
          phase={phase}
          mySeat={me?.seat}
          regentSeat={gameState.regent_seat}
          chambellanSeat={gameState.nominee_seat}
          players={players}
          cards={gameState.legislative_cards || []}
          pending={pending}
          onDiscard={(cardId) => act('DISCARD', { cardId })}
          vetoUnlocked={!!gameState.veto_unlocked}
          vetoRequested={!!gameState.veto_requested}
          vetoRefused={!!gameState.veto_refused}
          onVeto={() => act('VETO')}
          onVetoResponse={(accept) => act('VETO_RESPONSE', { accept })}
        />
      )}

      {phase === 'CONSEIL_ROYAUME' && (
        <>
          <ConseilReady gameState={gameState} me={me} pending={pending} onReady={() => act('CONSEIL_READY')} />
          <ConseilRoyaumePanel
            gameState={gameState}
            roomCode={roomCode}
            currentPlayerId={currentPlayerId}
            onSpeakToggle={handleSpeakToggle}
            speakingPlayers={gameState.speaking_players || []}
          />
        </>
      )}

      {phase === 'DEFIANCE' && (iAmDead ? <SpectatorNotice /> : (
        <DefiancePanel
          gameState={gameState}
          currentPlayerId={currentPlayerId}
          onVote={(targetSeat) => act('DEFIANCE_VOTE', { targetSeat })}
        />
      ))}

      {phase === 'POWER' && (
        <PowerPanel
          gameState={gameState}
          currentPlayerId={currentPlayerId}
          onAction={(actionType, payload) => act(actionType, payload || {})}
        />
      )}

      {phase === 'ENDGAME' && (
        <EndgameBanner
          gameState={gameState}
          currentPlayerId={currentPlayerId}
          isHost={isHost}
          pending={pending}
          onRestart={() => act('RESTART')}
          onHome={() => { forgetRoom(); navigate('/'); }}
        />
      )}
    </div>
  );

  const header = (
    <div className="darkoath-header relative z-20 sticky top-0 shrink-0">
      <div className="px-3 py-2 flex items-center justify-between max-w-7xl mx-auto gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <h1 className="hidden sm:block text-lg font-bold text-amber-400 shrink-0" style={{ fontFamily: "'Cinzel', serif", letterSpacing: '0.15em' }}>DARK OATH</h1>
          <Badge className="bg-amber-600 text-black shrink-0">{roomCode}</Badge>
          <span className="px-2 py-1 rounded text-[11px] uppercase tracking-widest truncate" style={{
            background: 'rgba(199, 168, 105, 0.15)',
            border: '1px solid rgba(199, 168, 105, 0.4)',
            color: '#e8d9a8',
            fontFamily: "'Cinzel', serif",
          }}>
            T{gameState.turn_number} · {formatPhaseName(phase)}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {phase === 'CONSEIL_ROYAUME' && gameState.conseil_royaume_start_time && (
            <ConseilCountdown startTime={gameState.conseil_royaume_start_time} duration={gameState.conseil_duration} />
          )}
          {isDesktop && gameState.regent_seat && (
            <GovernmentBadge label="Roi" icon="👑" seat={gameState.regent_seat} players={players} color="#c7a869" />
          )}
          {isDesktop && gameState.nominee_seat && ['VOTE', 'LEGIS_REGENT', 'LEGIS_CHAMBELLAN'].includes(phase) && (
            <GovernmentBadge label="Conseiller" icon="🗝️" seat={gameState.nominee_seat} players={players} color="#8a6d3a" />
          )}
          <button
            type="button"
            onClick={() => window.open('/?regles=1', '_blank', 'noopener')}
            className="w-9 h-9 rounded-full border border-amber-700/60 text-amber-200 hover:bg-amber-900/40"
            title="Règles du jeu"
            aria-label="Règles du jeu"
          >
            ?
          </button>
          <MusicControl
            enabled={musicEnabled}
            volume={musicVolume}
            onToggle={() => setMusicEnabled((v) => !v)}
            onVolume={setMusicVolume}
          />
        </div>
      </div>
      <TurnHint gameState={gameState} me={me} />
      {!isDesktop && mobileTab !== 'table' && <MiniTracks tracks={gameState.tracks} deckCount={gameState.deck_count} powerBoard={gameState.power_board} />}
      {offline && (
        <div className="px-3 py-1 text-center text-xs bg-red-950/90 text-red-200" role="alert">
          Connexion perdue — reconnexion en cours…
        </div>
      )}
    </div>
  );

  const sideTabs = (
    <div className="grid grid-cols-2 gap-1 mb-3 shrink-0" role="tablist">
      {[['chat', `💬 Chat${unread && sideTab !== 'chat' ? ` (${unread})` : ''}`], ['log', '📜 Chronique']].map(([key, label]) => (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={sideTab === key}
          onClick={() => setSideTab(key)}
          className={`py-2 rounded text-sm ${sideTab === key ? 'bg-amber-700 text-black font-bold' : 'bg-black/40 text-amber-100 hover:bg-amber-950/60'}`}
        >
          {label}
        </button>
      ))}
    </div>
  );

  const panelTitle = (
    <div className="flex items-center justify-between mb-3">
      <span className="text-sm uppercase tracking-widest text-amber-200" style={{ fontFamily: "'Cinzel', serif" }}>
        {formatPhaseName(phase)}
      </span>
      {me && (
        <span className="text-xs text-amber-200/60">Siège {me.seat}{iAmDead ? ' · 💀' : ''}</span>
      )}
    </div>
  );

  return (
    <div className="darkoath-game text-gray-100 relative flex flex-col" style={isDesktop ? { height: '100dvh', overflow: 'hidden' } : { minHeight: '100dvh' }}>
      <RevealOverlay gameState={gameState} />

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
                <p className="text-xl md:text-2xl" style={{ color: '#e8d9a8', fontFamily: "'Cinzel', serif", letterSpacing: '0.12em' }}>
                  🕯️ Le Conseil s'achève
                </p>
                <p className="text-sm text-amber-100/70 italic mt-1">Désignez un suspect — le peuple observe…</p>
              </>
            )}
            {defianceBanner === 'marked' && (() => {
              const markedPlayer = players.find((p) => p.seat === gameState?.marked_player_seat);
              return (
                <>
                  <p className="text-xl md:text-2xl" style={{ color: '#fecaca', fontFamily: "'Cinzel', serif", letterSpacing: '0.12em' }}>
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

      {/* Execution banner — seen by everyone */}
      {executionBanner && (
        <div className="fixed inset-0 pointer-events-none flex items-center justify-center z-40">
          <div className="px-6 py-5 rounded-lg text-center" style={{ background: 'rgba(20, 0, 0, 0.94)', border: '2px solid #dc2626', boxShadow: '0 0 40px rgba(220, 38, 38, 0.55)', maxWidth: '90vw', animation: 'fadeIn 0.3s ease-out' }}>
            <p className="text-2xl md:text-3xl" style={{ color: '#fecaca', fontFamily: "'Cinzel', serif", letterSpacing: '0.15em' }}>💀 Exécution</p>
            <p className="text-base text-red-200 mt-2">
              <strong>{executionBanner.name}</strong> <span className="text-red-300/70">· siège {executionBanner.seat}</span>
            </p>
            <p className="text-xs text-red-300/60 italic mt-2" style={{ fontFamily: "'IM Fell English', serif" }}>
              Le Roi a tranché. Que son âme erre à jamais.
            </p>
          </div>
        </div>
      )}

      {/* Colère du Peuple */}
      {showPeoplesAnger && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="colere-title">
          <div className="max-w-md w-full rounded-lg p-6 text-center" style={{ background: 'rgba(60,8,8,0.97)', border: '2px solid #dc2626' }}>
            <h2 id="colere-title" className="text-2xl text-red-100 flex items-center justify-center gap-2" style={{ fontFamily: "'Cinzel', serif" }}>
              <Zap className="h-7 w-7 text-yellow-400" /> Colère du Peuple <Zap className="h-7 w-7 text-yellow-400" />
            </h2>
            <p className="text-red-200 text-lg my-4">⚡ Trois gouvernements ratés : le peuple impose le décret du dessus de la pioche !</p>
            <p className="text-red-300 text-sm">Aucun pouvoir n'est déclenché, et les limites de mandat sont levées.</p>
            <Button autoFocus onClick={() => setShowPeoplesAnger(false)} className="mt-5 bg-red-600 hover:bg-red-700 text-white">Compris</Button>
          </div>
        </div>
      )}

      {header}
      <div className="shrink-0 relative z-10">
        <IdentityBar me={me} role={playerRole} teammates={gameState.teammates || []} compact={!isDesktop} />
        <TurnSteps gameState={gameState} me={me} role={playerRole} compact={!isDesktop} />
      </div>

      {isDesktop ? (
        <div className="flex flex-1 min-h-0">
          {/* Center — the throne room table */}
          <div className="flex-1 min-w-0 flex flex-col items-center justify-center p-4 darkoath-table-stage relative z-10 overflow-y-auto">
            {table('ring')}
          </div>

          {/* Actions — what to do now */}
          <div className="w-[400px] shrink-0 p-4 darkoath-sidebar border-l relative z-10 overflow-y-auto flex flex-col gap-3">
            <div className="darkoath-panel rounded-lg p-4">
              {panelTitle}
              {actions}
            </div>
            {!isWide && (
              <div className="darkoath-panel rounded-lg p-3 flex flex-col" style={{ height: 380 }}>
                {sideTabs}
                {sideTab === 'chat' ? chat : chronicle}
              </div>
            )}
          </div>

          {/* Right column — chat / chronicle (wide screens) */}
          {isWide && (
            <div className="w-80 shrink-0 p-4 flex flex-col darkoath-sidebar border-l relative z-10 min-h-0">
              {sideTabs}
              {sideTab === 'chat' ? chat : chronicle}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 p-3 overflow-y-auto" style={{ paddingBottom: 'calc(64px + env(safe-area-inset-bottom))' }}>
            {mobileTab === 'table' && (
              <div className="flex flex-col items-center gap-3">
                <div className="w-full darkoath-panel rounded-lg p-3">
                  {panelTitle}
                  {actions}
                </div>
                <div className="w-full">{table('grid')}</div>
              </div>
            )}
            {mobileTab === 'tracks' && (
              <div className="space-y-4">
                {playerRole && <RoleCard role={playerRole} teammates={gameState.teammates || []} players={players} />}
                {tracks}
              </div>
            )}
            {mobileTab === 'chat' && (
              <div className="flex flex-col" style={{ height: 'calc(100dvh - 210px)' }}>{chat}</div>
            )}
            {mobileTab === 'log' && (
              <div className="flex flex-col" style={{ height: 'calc(100dvh - 210px)' }}>{chronicle}</div>
            )}
          </div>

          {/* Bottom tabs */}
          <nav className="fixed bottom-0 left-0 right-0 bg-stone-950/95 border-t border-amber-900/50 z-30" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
            <div className="flex">
              {[
                ['table', '🏰', 'Table'],
                ['tracks', '🎭', 'Rôle & pistes'],
                ['chat', '💬', unread ? `Chat (${unread})` : 'Chat'],
                ['log', '📜', 'Chronique'],
              ].map(([key, icon, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMobileTab(key)}
                  className={`flex-1 py-2 text-center text-xs transition-all ${mobileTab === key ? 'bg-amber-600 text-black font-bold' : 'text-amber-100/80'} ${key === 'chat' && unread ? 'animate-pulse' : ''}`}
                  style={{ minHeight: 52 }}
                  aria-current={mobileTab === key ? 'page' : undefined}
                >
                  <div className="text-lg leading-none">{icon}</div>
                  {label}
                </button>
              ))}
            </div>
          </nav>
        </div>
      )}
    </div>
  );
};

export default GameInterface;

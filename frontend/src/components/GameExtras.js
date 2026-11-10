import React, { useEffect, useRef, useState } from 'react';
import { Check, ScrollText, Timer, X } from 'lucide-react';
import { serverNow, powerMarks } from '../lib/game';
import { sfx } from './GameJuice';

const cinzel = { fontFamily: "'Lora', Georgia, serif", letterSpacing: '0.08em' };
const fell = { fontFamily: "'Lora', Georgia, serif" };

// ---------------------------------------------------------------------
// Layout helper: render only one layout (avoids double-mounting the voice
// panel, which used to open two microphone pipelines).
// ---------------------------------------------------------------------
export const useIsDesktop = () => {
  const query = '(min-width: 1024px)';
  const [match, setMatch] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener ? mq.addEventListener('change', on) : mq.addListener(on);
    return () => (mq.removeEventListener ? mq.removeEventListener('change', on) : mq.removeListener(on));
  }, []);
  return match;
};

// ---------------------------------------------------------------------
// Sound cues and staged reveals live in GameJuice.js
// ---------------------------------------------------------------------
export const playCue = (kind) => sfx(kind);
export { RevealOverlay } from './GameJuice';

// ---------------------------------------------------------------------
// Who must act now? (mirrors server pending_actor_ids)
// ---------------------------------------------------------------------
export const pendingInfo = (gs, me) => {
  if (!gs || gs.phase === 'ENDGAME') return { mine: false, label: '' };
  const players = gs.players || [];
  const bySeat = (s) => players.find((p) => p.seat === s);
  const king = bySeat(gs.regent_seat);
  const nominee = bySeat(gs.nominee_seat);
  const alive = me && me.alive !== false;
  switch (gs.phase) {
    case 'NOMINATION':
      return me?.seat === gs.regent_seat
        ? { mine: true, label: 'À vous : nommez votre Conseiller' }
        : { mine: false, label: `${king?.name || 'Le Roi'} choisit son Conseiller…` };
    case 'VOTE':
      return alive && me.seat !== gs.regent_seat && me.seat !== gs.nominee_seat && !(gs.votes_cast || []).includes(me.id)
        ? { mine: true, label: 'À vous : votez pour ce gouvernement' }
        : { mine: false, label: 'Vote en cours…' };
    case 'LEGIS_REGENT':
      return me?.seat === gs.regent_seat
        ? { mine: true, label: 'À vous : défaussez un décret' }
        : { mine: false, label: `${king?.name || 'Le Roi'} examine 3 décrets…` };
    case 'LEGIS_CHAMBELLAN':
      if (gs.veto_requested) {
        return me?.seat === gs.regent_seat
          ? { mine: true, label: 'À vous : acceptez ou refusez le veto' }
          : { mine: false, label: `${king?.name || 'Le Roi'} décide du veto…` };
      }
      return me?.seat === gs.nominee_seat
        ? { mine: true, label: 'À vous : adoptez un décret' }
        : { mine: false, label: `${nominee?.name || 'Le Conseiller'} choisit le décret…` };
    case 'POWER':
      return me?.seat === gs.regent_seat
        ? { mine: true, label: ({ EXECUTE: 'À vous : exécutez un joueur', INVESTIGATE: 'À vous : enquêtez sur un joueur', PEEK: 'À vous : regardez la pioche', SPECIAL_ELECTION: 'À vous : choisissez le prochain Roi' })[gs.active_power] || 'À vous : utilisez votre pouvoir' }
        : { mine: false, label: `${king?.name || 'Le Roi'} exerce son pouvoir…` };
    case 'DEFIANCE':
      return alive && !gs.defiance_has_voted
        ? { mine: true, label: 'À vous : désignez un suspect ou passez' }
        : { mine: false, label: 'Défiance en cours…' };
    case 'CONSEIL_ROYAUME':
      return { mine: false, label: 'Conseil du Royaume : débattez !' };
    case 'JUGEMENT':
      return alive && !gs.arrow_my_target
        ? { mine: true, label: 'À vous : désignez celui que vous croyez être le Tyran 🏹' }
        : { mine: false, label: `Flèche du Peuple : ${(gs.arrow_voted_ids || []).length}/${players.filter((p) => p.alive).length} ont désigné…` };
    case 'COMPLOT':
      return alive && gs.your_role === 'CONJURE' && !gs.plot_has_voted
        ? { mine: true, label: 'À vous : choisissez le Fidèle à abattre 🗡️' }
        : { mine: false, label: 'La nuit tombe… Les Traîtres complotent 🌙' };
    default:
      return { mine: false, label: '' };
  }
};

// Countdown before "le destin choisit à votre place" (AFK takeover)
export const ActionTimer = ({ gameState }) => {
  const [left, setLeft] = useState(null);
  const started = gameState?.phase_started_at;
  const timeout = gameState?.afk_timeout || 45;
  const phase = gameState?.phase;
  const relevant = ['NOMINATION', 'VOTE', 'LEGIS_REGENT', 'LEGIS_CHAMBELLAN', 'POWER', 'JUGEMENT', 'COMPLOT'].includes(phase);
  useEffect(() => {
    if (!started || !relevant) { setLeft(null); return undefined; }
    const tick = () => setLeft(Math.max(0, Math.ceil(timeout - (serverNow() - started))));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [started, timeout, relevant]);
  if (left === null) return null;
  const urgent = left <= 10;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs tabular-nums"
      style={{
        background: urgent ? 'rgba(127, 29, 29, 0.7)' : 'rgba(20, 14, 8, 0.7)',
        border: `1px solid ${urgent ? '#dc2626' : 'rgba(199,168,105,0.45)'}`,
        color: urgent ? '#fecaca' : '#e8d9a8',
      }}
      title="Passé ce délai, le destin choisit à la place du joueur"
    >
      <Timer className="h-3 w-3" /> {left}s
    </span>
  );
};

// "Your turn" strip, always visible under the header
export const TurnHint = ({ gameState, me }) => {
  const info = pendingInfo(gameState, me);
  const prev = useRef(false);
  useEffect(() => {
    if (info.mine && !prev.current) {
      playCue('turn');
      if (navigator.vibrate) navigator.vibrate(80);
    }
    prev.current = info.mine;
    document.title = info.mine ? '⚔️ À vous de jouer — Dark Oath' : 'Dark Oath';
  }, [info.mine]);
  useEffect(() => () => { document.title = 'Dark Oath'; }, []);
  if (!info.label) return null;
  return (
    <div
      className="px-3 py-2 text-center text-sm flex items-center justify-center gap-2 flex-wrap"
      role="status"
      aria-live="polite"
      style={{
        background: info.mine ? 'linear-gradient(90deg, rgba(120,53,15,0.2), rgba(180,90,30,0.55), rgba(120,53,15,0.2))' : 'rgba(10,6,4,0.6)',
        borderBottom: `1px solid ${info.mine ? '#c7a869' : 'rgba(199,168,105,0.2)'}`,
        color: info.mine ? '#fde68a' : 'rgba(232,217,168,0.8)',
        ...cinzel,
      }}
    >
      <span className={info.mine ? 'font-bold' : ''}>{info.label}</span>
      <ActionTimer gameState={gameState} />
    </div>
  );
};

// Compact tracks for small screens (L x/5 · T x/6 · Crise x/3)
export const MiniTracks = ({ tracks = {}, deckCount, powerBoard }) => {
  const pip = (n, max, color, special = {}) => (
    <span className="inline-flex gap-0.5 align-middle">
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className="inline-flex items-center justify-center rounded-sm"
          style={{
            width: 14, height: 14, fontSize: 9,
            background: i < n ? color : 'rgba(20,14,8,0.8)',
            border: `1px solid ${i < n ? color : 'rgba(199,168,105,0.3)'}`,
            color: '#fff',
          }}
        >
          {i >= n && special[i + 1] ? special[i + 1] : ''}
        </span>
      ))}
    </span>
  );
  return (
    <div className="flex items-center justify-center gap-3 flex-wrap text-[11px] px-2 py-1.5" style={{ color: '#e8d9a8', background: 'rgba(10,6,4,0.75)', borderBottom: '1px solid rgba(199,168,105,0.2)' }}>
      <span className="inline-flex items-center gap-1">🛡️ {pip(tracks.loyal || 0, 5, '#3b82f6', { 3: '🏹' })}</span>
      <span className="inline-flex items-center gap-1">⚔️ {pip(tracks.conjure || 0, 6, '#dc2626', { ...powerMarks(powerBoard), 2: '🗡️' })}</span>
      <span className="inline-flex items-center gap-1">⚡ {pip(tracks.crisis || 0, 3, '#f59e0b')}</span>
      {typeof deckCount === 'number' && <span className="opacity-70">📜 {deckCount}</span>}
    </div>
  );
};

// ---------------------------------------------------------------------
// Chronique du Royaume (public game log)
// ---------------------------------------------------------------------
const EVENT_ICON = {
  start: '📜', nomination: '👑', vote: '🗳️', decree: '⚖️', reshuffle: '🔄', marked: '🎯',
  investigate: '🔍', execute: '💀', endgame: '🏁', afk: '⏳', info: 'ℹ️',
  arrow_start: '🏹', arrow: '🏹', plot_start: '🌙', plot: '🗡️',
};

export const Chronicle = ({ events = [], investigations = {}, players = [], className = '' }) => {
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'nearest' }); }, [events.length]);
  const name = (seat) => players.find((p) => p.seat === Number(seat))?.name || `Siège ${seat}`;
  const myInv = Object.entries(investigations || {});
  return (
    <div className={`flex flex-col min-h-0 ${className}`}>
      {myInv.length > 0 && (
        <div className="mb-2 p-2 rounded text-xs" style={{ background: 'rgba(88,28,135,0.25)', border: '1px solid rgba(168,85,247,0.4)', color: '#e9d5ff' }}>
          🔒 Vos enquêtes secrètes : {myInv.map(([seat, camp]) => `${name(seat)} = ${camp}`).join(' · ')}
        </div>
      )}
      <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 min-h-0">
        {events.length === 0 && <p className="text-xs italic opacity-60" style={{ color: '#e8d9a8' }}>La chronique est encore vierge…</p>}
        {events.map((e) => {
          const color = e.kind === 'decree' ? (e.type === 'LOYAL' ? '#93c5fd' : '#fca5a5')
            : e.kind === 'endgame' ? '#fde68a'
            : e.kind === 'execute' ? '#fca5a5'
            : e.kind === 'plot' || e.kind === 'plot_start' ? '#fca5a5'
            : e.kind === 'arrow' || e.kind === 'arrow_start' ? '#93c5fd'
            : 'rgba(232,217,168,0.9)';
          return (
            <div key={e.id} className="flex gap-2 text-xs leading-snug" style={{ color }}>
              <span className="shrink-0 w-10 opacity-60 tabular-nums">T{e.turn}</span>
              <span className="shrink-0">{EVENT_ICON[e.kind] || '•'}</span>
              <span>{e.text}</span>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// Conseil: "Prêt" button (ends the Conseil early when every human is ready)
// ---------------------------------------------------------------------
export const ConseilReady = ({ gameState, me, onReady, pending }) => {
  const ready = gameState?.conseil_ready || [];
  const iAmReady = me && ready.includes(me.id);
  const humans = (gameState?.players || []).filter((p) => p.alive && !p.is_bot && p.connected);
  const readyHumans = humans.filter((p) => ready.includes(p.id)).length;
  if (!me || me.alive === false) return null;
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg mb-3" style={{ background: 'rgba(20,14,8,0.6)', border: '1px solid rgba(199,168,105,0.35)' }}>
      <button
        type="button"
        onClick={onReady}
        disabled={iAmReady || pending}
        className="px-4 py-2 rounded font-bold text-sm disabled:opacity-60"
        style={{ ...cinzel, background: iAmReady ? 'rgba(22,101,52,0.5)' : 'linear-gradient(180deg,#c7a869,#8a6d3a)', color: iAmReady ? '#bbf7d0' : '#1a1008', border: '1px solid #c7a869' }}
      >
        {iAmReady ? '✓ Prêt' : 'Je suis prêt'}
      </button>
      <span className="text-xs" style={{ color: 'rgba(232,217,168,0.8)' }}>
        {readyHumans}/{humans.length} prêts — le Conseil se termine quand tout le monde l'est.
      </span>
    </div>
  );
};

// Dead player notice
export const SpectatorNotice = () => (
  <div className="text-center p-4 rounded-lg" style={{ background: 'rgba(20,0,0,0.6)', border: '1px solid rgba(220,38,38,0.4)' }}>
    <div className="text-3xl mb-1">💀</div>
    <p className="text-sm" style={{ ...cinzel, color: '#fecaca' }}>Vous avez été exécuté</p>
    <p className="text-xs italic mt-1" style={{ ...fell, color: 'rgba(254,202,202,0.75)' }}>
      Vous restez spectateur. Ne révélez rien aux vivants…
    </p>
  </div>
);

export const ChronicleIcon = ScrollText;

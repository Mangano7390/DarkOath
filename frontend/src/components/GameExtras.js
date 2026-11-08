import React, { useEffect, useRef, useState } from 'react';
import { Check, ScrollText, Timer, X } from 'lucide-react';
import { serverNow } from '../lib/game';

const cinzel = { fontFamily: "'Cinzel', serif", letterSpacing: '0.08em' };
const fell = { fontFamily: "'IM Fell English', serif" };

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
// Short sound cues generated with WebAudio (no extra assets).
// ---------------------------------------------------------------------
let _ctx = null;
export const playCue = (kind) => {
  try {
    const enabled = localStorage.getItem('darkoath_music_enabled');
    if (enabled === 'false') return;
    _ctx = _ctx || new (window.AudioContext || window.webkitAudioContext)();
    const ctx = _ctx;
    const notes = {
      turn: [[660, 0], [880, 0.12]],
      loyal: [[523, 0], [659, 0.12], [784, 0.24]],
      traitor: [[220, 0], [185, 0.18], [147, 0.36]],
      vote: [[440, 0], [440, 0.1]],
      death: [[110, 0], [82, 0.3]],
    }[kind] || [[440, 0]];
    notes.forEach(([freq, at]) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = kind === 'traitor' || kind === 'death' ? 'sawtooth' : 'triangle';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + at);
      g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.35);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + at);
      o.stop(ctx.currentTime + at + 0.4);
    });
  } catch {
    // audio not available — ignore
  }
};

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
      return alive && !(gs.votes_cast || []).includes(me.id)
        ? { mine: true, label: 'À vous : votez pour ce gouvernement' }
        : { mine: false, label: 'Vote en cours…' };
    case 'LEGIS_REGENT':
      return me?.seat === gs.regent_seat
        ? { mine: true, label: 'À vous : défaussez un décret' }
        : { mine: false, label: `${king?.name || 'Le Roi'} examine 3 décrets…` };
    case 'LEGIS_CHAMBELLAN':
      return me?.seat === gs.nominee_seat
        ? { mine: true, label: 'À vous : adoptez un décret' }
        : { mine: false, label: `${nominee?.name || 'Le Conseiller'} choisit le décret…` };
    case 'POWER':
      return me?.seat === gs.regent_seat
        ? { mine: true, label: gs.active_power === 'EXECUTE' ? 'À vous : exécutez un joueur' : 'À vous : enquêtez sur un joueur' }
        : { mine: false, label: `${king?.name || 'Le Roi'} exerce son pouvoir…` };
    case 'DEFIANCE':
      return alive && !gs.defiance_has_voted
        ? { mine: true, label: 'À vous : désignez un suspect ou passez' }
        : { mine: false, label: 'Défiance en cours…' };
    case 'CONSEIL_ROYAUME':
      return { mine: false, label: 'Conseil du Royaume : débattez !' };
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
  const relevant = ['NOMINATION', 'VOTE', 'LEGIS_REGENT', 'LEGIS_CHAMBELLAN', 'POWER'].includes(phase);
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
export const MiniTracks = ({ tracks = {}, deckCount }) => {
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
      <span className="inline-flex items-center gap-1">🛡️ {pip(tracks.loyal || 0, 5, '#3b82f6')}</span>
      <span className="inline-flex items-center gap-1">⚔️ {pip(tracks.conjure || 0, 6, '#dc2626', { 2: '🔍', 4: '🪓' })}</span>
      <span className="inline-flex items-center gap-1">⚡ {pip(tracks.crisis || 0, 3, '#f59e0b')}</span>
      {typeof deckCount === 'number' && <span className="opacity-70">📜 {deckCount}</span>}
    </div>
  );
};

// ---------------------------------------------------------------------
// Reveal overlay: vote result (who voted what) and enacted decree
// ---------------------------------------------------------------------
export const RevealOverlay = ({ gameState }) => {
  const [reveal, setReveal] = useState(null);
  const seen = useRef({ vote: null, decree: null, init: false });

  useEffect(() => {
    const lv = gameState?.last_vote;
    const ld = gameState?.last_decree;
    const s = seen.current;
    if (!s.init) {
      // Don't replay old reveals when (re)opening the page
      s.vote = lv?.ts || null;
      s.decree = ld?.ts || null;
      s.init = true;
      return undefined;
    }
    let next = null;
    if (ld && ld.ts !== s.decree) {
      s.decree = ld.ts;
      next = { kind: 'decree', data: ld };
      playCue(ld.type === 'LOYAL' ? 'loyal' : 'traitor');
    }
    if (lv && lv.ts !== s.vote) {
      s.vote = lv.ts;
      // a vote that triggered the Colère du Peuple shows both: vote first
      next = { kind: 'vote', data: lv, then: next };
      playCue('vote');
    }
    if (next) setReveal(next);
    return undefined;
  }, [gameState?.last_vote, gameState?.last_decree]);

  useEffect(() => {
    if (!reveal) return undefined;
    const t = setTimeout(() => setReveal(reveal.then || null), reveal.kind === 'vote' ? 4200 : 3200);
    return () => clearTimeout(t);
  }, [reveal]);

  if (!reveal) return null;
  const players = gameState?.players || [];
  const name = (seat) => players.find((p) => p.seat === seat)?.name || `Siège ${seat}`;

  if (reveal.kind === 'decree') {
    const loyal = reveal.data.type === 'LOYAL';
    const color = loyal ? '#3b82f6' : '#dc2626';
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none p-4" aria-live="assertive">
        <div className="px-6 py-5 rounded-lg text-center" style={{ background: 'rgba(10,6,4,0.94)', border: `2px solid ${color}`, boxShadow: `0 0 40px ${color}88`, animation: 'fadeIn .3s ease-out', maxWidth: 420 }}>
          <div className="text-5xl mb-2">{loyal ? '🛡️' : '⚔️'}</div>
          <div className="text-xl md:text-2xl font-bold" style={{ ...cinzel, color }}>
            {loyal ? 'Décret Loyal adopté' : 'Décret de Trahison adopté'}
          </div>
          <div className="text-sm mt-2 italic" style={{ ...fell, color: 'rgba(232,217,168,0.85)' }}>
            {reveal.data.auto
              ? 'Imposé par la Colère du Peuple.'
              : `Par ${name(reveal.data.regent_seat)} (Roi) et ${name(reveal.data.chambellan_seat)} (Conseiller).`}
          </div>
        </div>
      </div>
    );
  }

  const lv = reveal.data;
  const elected = lv.result === 'elected';
  const ballots = Object.entries(lv.ballots || {}).map(([seat, v]) => ({ seat: Number(seat), v }));
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/40" onClick={() => setReveal(reveal.then || null)} aria-live="assertive">
      <div className="w-full max-w-md px-5 py-4 rounded-lg" style={{ background: 'rgba(10,6,4,0.96)', border: `2px solid ${elected ? '#16a34a' : '#b91c1c'}`, boxShadow: '0 0 40px rgba(0,0,0,0.8)', animation: 'fadeIn .3s ease-out' }}>
        <div className="text-center mb-3">
          <div className="text-xs uppercase tracking-widest opacity-70" style={{ ...cinzel, color: '#e8d9a8' }}>Résultat du vote</div>
          <div className="text-2xl font-bold" style={{ ...cinzel, color: elected ? '#86efac' : '#fca5a5' }}>
            {elected ? 'Gouvernement élu' : 'Gouvernement rejeté'}
          </div>
          <div className="text-sm" style={{ color: '#e8d9a8' }}>
            👑 {name(lv.regent_seat)} · 🗝️ {name(lv.nominee_seat)} — {lv.yes} oui / {lv.no} non
          </div>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {ballots.map(({ seat, v }) => (
            <div key={seat} className="flex items-center justify-between px-2 py-1 rounded text-sm" style={{ background: v === 'oui' ? 'rgba(22,101,52,0.35)' : 'rgba(127,29,29,0.35)', border: `1px solid ${v === 'oui' ? 'rgba(134,239,172,0.4)' : 'rgba(252,165,165,0.4)'}`, color: '#f5e9c8' }}>
              <span className="truncate">{name(seat)}</span>
              <span className="flex items-center gap-1 font-bold" style={{ color: v === 'oui' ? '#86efac' : '#fca5a5' }}>
                {v === 'oui' ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}{v.toUpperCase()}
              </span>
            </div>
          ))}
        </div>
        <div className="text-center text-[11px] mt-3 opacity-60" style={{ color: '#e8d9a8' }}>Touchez pour fermer</div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// Chronique du Royaume (public game log)
// ---------------------------------------------------------------------
const EVENT_ICON = {
  start: '📜', nomination: '👑', vote: '🗳️', decree: '⚖️', reshuffle: '🔄', marked: '🎯',
  investigate: '🔍', execute: '💀', endgame: '🏁', afk: '⏳', info: 'ℹ️',
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

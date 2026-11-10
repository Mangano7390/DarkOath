/**
 * Everything that makes a game of Dark Oath *feel* good:
 * synthesized sound effects, staged reveals for the key moments, quick
 * reactions (emotes), tension warnings, the in-game confirm dialog and the
 * end-of-game recap. No extra assets: all sounds are generated with WebAudio.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';

const LORA = "'Lora', Georgia, serif";
const CINZEL = "'Cinzel', serif";
const GOLD = '#c7a869';
const PARCH = '#e8d9a8';

// ---------------------------------------------------------------------
// Sound effects
// ---------------------------------------------------------------------
let _ctx = null;
let _noise = null;

const audio = () => {
  const enabled = localStorage.getItem('darkoath_music_enabled');
  if (enabled === 'false') return null;
  _ctx = _ctx || new (window.AudioContext || window.webkitAudioContext)();
  if (_ctx.state === 'suspended') _ctx.resume().catch(() => {});
  return _ctx;
};

const sfxVolume = () => {
  const raw = parseFloat(localStorage.getItem('darkoath_music_volume'));
  const music = Number.isFinite(raw) ? Math.min(1, Math.max(0, raw > 1 ? raw / 100 : raw)) : 0.2;
  // effects stay audible even when the music is low, but follow it down to silence
  return music === 0 ? 0 : 0.35 + music * 0.65;
};

const noiseBuffer = (ctx) => {
  if (_noise && _noise.sampleRate === ctx.sampleRate) return _noise;
  _noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = _noise.getChannelData(0);
  for (let i = 0; i < d.length; i += 1) d[i] = Math.random() * 2 - 1;
  return _noise;
};

// One enveloped oscillator. `to` glides the pitch, `filter` softens it.
const tone = (ctx, out, { f, at = 0, dur = 0.3, type = 'triangle', gain = 0.2, to = null, attack = 0.012, filter = null }) => {
  const t0 = ctx.currentTime + at;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t0);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  let node = o;
  if (filter) {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = filter;
    node.connect(lp);
    node = lp;
  }
  node.connect(g).connect(out);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
};

// A burst of filtered noise: drums, whooshes, steel.
const noise = (ctx, out, { at = 0, dur = 0.2, gain = 0.2, from = 800, to = null, type = 'bandpass', q = 1 }) => {
  const t0 = ctx.currentTime + at;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  const flt = ctx.createBiquadFilter();
  flt.type = type;
  flt.Q.value = q;
  flt.frequency.setValueAtTime(from, t0);
  if (to) flt.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + Math.min(0.03, dur / 3));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(flt).connect(g).connect(out);
  src.start(t0);
  src.stop(t0 + dur + 0.05);
};

const drum = (ctx, out, at = 0, gain = 0.5) => {
  tone(ctx, out, { f: 130, to: 45, at, dur: 0.28, type: 'sine', gain });
  noise(ctx, out, { at, dur: 0.08, gain: gain * 0.35, from: 300, type: 'lowpass' });
};

const bell = (ctx, out, f, at = 0, gain = 0.3, dur = 2.4) => {
  [[1, 1], [2.01, 0.5], [2.76, 0.32], [5.4, 0.16]].forEach(([mult, amp]) => {
    tone(ctx, out, { f: f * mult, at, dur: dur / Math.sqrt(mult), type: 'sine', gain: gain * amp, attack: 0.004 });
  });
};

const brass = (ctx, out, f, at, dur, gain = 0.16) => {
  tone(ctx, out, { f, at, dur, type: 'sawtooth', gain, filter: 1800, attack: 0.03 });
  tone(ctx, out, { f: f * 1.003, at, dur, type: 'sawtooth', gain: gain * 0.6, filter: 1400, attack: 0.03 });
};

const RECIPES = {
  turn: (c, o) => { bell(c, o, 880, 0, 0.16, 0.9); bell(c, o, 1320, 0.14, 0.12, 0.9); },
  click: (c, o) => tone(c, o, { f: 520, dur: 0.06, type: 'square', gain: 0.05, filter: 1200 }),
  pop: (c, o) => tone(c, o, { f: 420, to: 880, dur: 0.11, type: 'sine', gain: 0.16 }),
  tick: (c, o) => { tone(c, o, { f: 950, dur: 0.05, type: 'square', gain: 0.07, filter: 2400 }); noise(c, o, { dur: 0.04, gain: 0.08, from: 2600, q: 3 }); },
  drum: (c, o) => { drum(c, o, 0, 0.5); drum(c, o, 0.22, 0.35); },
  roll: (c, o) => { for (let i = 0; i < 9; i += 1) drum(c, o, i * 0.085, 0.12 + i * 0.035); },
  vote: (c, o) => { drum(c, o, 0, 0.4); },
  elected: (c, o) => {
    drum(c, o, 0, 0.5);
    [[392, 0], [523, 0.16], [659, 0.32]].forEach(([f, at]) => brass(c, o, f, at, 0.3));
    brass(c, o, 784, 0.48, 0.9, 0.18); brass(c, o, 523, 0.48, 0.9, 0.1);
  },
  rejected: (c, o) => {
    drum(c, o, 0, 0.55);
    [[392, 0], [349, 0.2], [294, 0.4]].forEach(([f, at]) => brass(c, o, f, at, 0.34, 0.14));
    tone(c, o, { f: 147, at: 0.6, dur: 0.9, type: 'sawtooth', gain: 0.14, filter: 600 });
  },
  loyal: (c, o) => {
    [523, 659, 784, 1047].forEach((f, i) => bell(c, o, f, i * 0.09, 0.14, 1.6));
    brass(c, o, 262, 0, 1.1, 0.1);
  },
  traitor: (c, o) => {
    drum(c, o, 0, 0.6);
    [110, 116.5, 164.8].forEach((f) => tone(c, o, { f, dur: 1.6, type: 'sawtooth', gain: 0.13, filter: 700, attack: 0.05 }));
    noise(c, o, { dur: 1.2, gain: 0.06, from: 1800, to: 200, type: 'lowpass' });
  },
  death: (c, o) => { bell(c, o, 98, 0, 0.42, 3.4); drum(c, o, 0, 0.5); bell(c, o, 98, 1.25, 0.26, 3); },
  arrow: (c, o) => {
    noise(c, o, { dur: 0.45, gain: 0.3, from: 500, to: 5200, q: 2 });
    drum(c, o, 0.46, 0.6);
    tone(c, o, { f: 190, at: 0.47, dur: 0.5, type: 'triangle', gain: 0.12 });
  },
  plot: (c, o) => {
    noise(c, o, { dur: 0.3, gain: 0.2, from: 6000, to: 2400, q: 6 });
    tone(c, o, { f: 2100, to: 1500, dur: 0.5, type: 'sine', gain: 0.07 });
    tone(c, o, { f: 73, at: 0.05, dur: 1.8, type: 'sawtooth', gain: 0.16, filter: 420, attack: 0.2 });
  },
  tension: (c, o) => { [0, 0.24, 0.9, 1.14].forEach((at, i) => drum(c, o, at, i % 2 ? 0.3 : 0.45)); },
  power: (c, o) => { noise(c, o, { dur: 0.6, gain: 0.1, from: 300, to: 3000, q: 1.5 }); bell(c, o, 659, 0.2, 0.16, 1.2); },
};

export const sfx = (kind) => {
  try {
    const ctx = audio();
    const recipe = RECIPES[kind];
    if (!ctx || !recipe) return;
    const vol = sfxVolume();
    if (!vol) return;
    const out = ctx.createGain();
    out.gain.value = vol;
    out.connect(ctx.destination);
    recipe(ctx, out);
  } catch {
    // audio unavailable: the game stays fully playable
  }
};

// ---------------------------------------------------------------------
// In-game confirmation dialog (replaces the browser's window.confirm)
// ---------------------------------------------------------------------
export const useConfirm = () => {
  const [ask, setAsk] = useState(null);
  const confirm = useCallback((opts) => new Promise((resolve) => setAsk({ ...opts, resolve })), []);
  const close = (ok) => { if (ask) { ask.resolve(ok); setAsk(null); } };

  useEffect(() => {
    if (!ask) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') { ask.resolve(false); setAsk(null); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ask]);

  const tone_ = ask?.danger ? '#dc2626' : GOLD;
  const dialog = ask ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}
      role="dialog" aria-modal="true" aria-label={ask.title} onClick={() => close(false)}>
      <div className="w-full max-w-sm rounded-xl p-5 text-center do-pop" onClick={(e) => e.stopPropagation()}
        style={{ background: 'linear-gradient(180deg, #2a1b0e, #120b06)', border: `2px solid ${tone_}`, boxShadow: `0 0 40px ${tone_}55` }}>
        <div className="text-4xl mb-2" aria-hidden>{ask.icon || '⚜️'}</div>
        <h2 className="text-xl font-bold mb-1" style={{ fontFamily: CINZEL, color: ask.danger ? '#fca5a5' : '#fde68a' }}>{ask.title}</h2>
        {ask.text && <p className="text-sm mb-4" style={{ fontFamily: LORA, color: PARCH }}>{ask.text}</p>}
        <div className="flex gap-2 justify-center">
          <button type="button" onClick={() => close(false)} className="px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ fontFamily: LORA, color: PARCH, background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(199,168,105,0.4)' }}>
            {ask.cancelLabel || 'Annuler'}
          </button>
          <button type="button" autoFocus onClick={() => close(true)} className="px-4 py-2 rounded-lg text-sm font-bold"
            style={{ fontFamily: LORA, color: ask.danger ? '#fff' : '#1a1008', background: ask.danger ? '#b91c1c' : GOLD, border: `1px solid ${tone_}` }}>
            {ask.confirmLabel || 'Confirmer'}
          </button>
        </div>
      </div>
    </div>
  ) : null;
  return [confirm, dialog];
};

// ---------------------------------------------------------------------
// Emotes: quick reactions shown above the seats
// ---------------------------------------------------------------------
export const EMOTES = [
  { id: 'clap', icon: '👏', label: 'Bravo' },
  { id: 'laugh', icon: '😂', label: 'Haha' },
  { id: 'sus', icon: '🤨', label: 'Louche…' },
  { id: 'shock', icon: '😱', label: 'Quoi ?!' },
  { id: 'angry', icon: '😡', label: 'Scandale !' },
  { id: 'pray', icon: '🙏', label: 'Pitié' },
  { id: 'skull', icon: '💀', label: 'Aïe' },
  { id: 'crown', icon: '👑', label: 'Vive le Roi' },
];
const EMOTE_ICON = Object.fromEntries(EMOTES.map((e) => [e.id, e.icon]));

export const EmoteBar = ({ onEmote }) => {
  const [cooling, setCooling] = useState(false);
  const send = (id) => {
    if (cooling) return;
    setCooling(true);
    sfx('pop');
    onEmote(id);
    setTimeout(() => setCooling(false), 1600);
  };
  return (
    <div className="flex items-center justify-center gap-1 flex-wrap" role="group" aria-label="Réagir">
      <span className="text-[10px] uppercase tracking-widest mr-1" style={{ fontFamily: LORA, color: 'rgba(232,217,168,0.55)' }}>Réagir</span>
      {EMOTES.map((e) => (
        <button key={e.id} type="button" onClick={() => send(e.id)} disabled={cooling} title={e.label} aria-label={e.label}
          className="w-9 h-9 rounded-full text-lg leading-none transition-transform hover:scale-125 active:scale-95 disabled:opacity-40"
          style={{ background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(199,168,105,0.35)' }}>
          {e.icon}
        </button>
      ))}
    </div>
  );
};

// The latest fresh emote of a seat, floating above its card.
export const SeatEmote = ({ gs, seat }) => {
  const list = (gs.emotes || []).filter((e) => e.seat === seat);
  const last = list[list.length - 1];
  if (!last || (gs.server_time || 0) - last.ts > 5) return null;
  return (
    <span key={last.id} className="absolute -top-5 -right-2 z-10 text-3xl pointer-events-none do-emote" aria-hidden
      style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.8))' }}>
      {EMOTE_ICON[last.emote] || '❔'}
    </span>
  );
};

// ---------------------------------------------------------------------
// Tension: tell the table when the game is one step from ending
// ---------------------------------------------------------------------
export const TensionBanner = ({ gameState }) => {
  const t = gameState?.tracks || {};
  const loyal = t.loyal || 0;
  const conjure = t.conjure || 0;
  const items = [];
  if (loyal >= 4) items.push({ key: 'l4', color: '#93c5fd', text: 'Balle de match des Fidèles : encore un Décret Loyal et la Couronne est sauvée.' });
  if (conjure >= 5) items.push({ key: 'c5', color: '#fca5a5', text: 'Balle de match des Traîtres : encore une Trahison et le trône tombe.' });
  if (conjure >= 3) items.push({ key: 'c3', color: '#d8b4fe', text: 'Danger : si le Tyran est élu Conseiller, les Traîtres gagnent sur-le-champ.' });
  if ((t.crisis || 0) >= 2) items.push({ key: 'k2', color: '#fcd34d', text: 'Le peuple gronde : un rejet de plus et il impose le décret du dessus de la pioche.' });
  const keys = items.map((i) => i.key).join(',');
  const heard = useRef(null);
  useEffect(() => {
    if (heard.current === null) { heard.current = keys; return; }
    const before = heard.current.split(',');
    if (keys.split(',').some((k) => k && !before.includes(k))) sfx('tension');
    heard.current = keys;
  }, [keys]);
  if (!items.length || gameState?.phase === 'ENDGAME') return null;
  return (
    <div className="flex flex-col gap-1 w-full" role="status">
      {items.map((i) => (
        <div key={i.key} className="rounded-lg px-3 py-1.5 text-xs md:text-sm text-center do-tension"
          style={{ fontFamily: LORA, color: i.color, background: 'rgba(10,6,4,0.8)', border: `1px solid ${i.color}66` }}>
          <span aria-hidden>⚠️ </span>{i.text}
        </div>
      ))}
    </div>
  );
};

// ---------------------------------------------------------------------
// Staged reveals: vote, decree, Flèche du Peuple, Complot
// ---------------------------------------------------------------------
const Backdrop = ({ children, onSkip, color = '#000' }) => (
  <div className="fixed inset-0 z-40 flex items-center justify-center p-4 do-fade" onClick={onSkip} aria-live="assertive"
    style={{ background: `radial-gradient(ellipse at center, ${color}33 0%, rgba(0,0,0,0.78) 70%)` }}>
    {children}
  </div>
);

const Skip = () => (
  <div className="text-center text-[11px] mt-3" style={{ color: 'rgba(232,217,168,0.5)', fontFamily: LORA }}>Touchez pour passer</div>
);

export const RevealOverlay = ({ gameState }) => {
  const [reveal, setReveal] = useState(null);
  const [step, setStep] = useState(0);
  const seen = useRef({ vote: null, decree: null, arrow: null, plot: null, init: false });

  useEffect(() => {
    const lv = gameState?.last_vote;
    const ld = gameState?.last_decree;
    const la = gameState?.last_arrow;
    const lp = gameState?.last_plot;
    const s = seen.current;
    if (!s.init) {
      // never replay old reveals when (re)opening the page
      s.vote = lv?.ts || null; s.decree = ld?.ts || null; s.arrow = la?.ts || null; s.plot = lp?.ts || null;
      s.init = true;
      return;
    }
    let next = null;
    if (lp && lp.ts !== s.plot) { s.plot = lp.ts; next = { kind: 'plot', data: lp }; }
    if (la && la.ts !== s.arrow) { s.arrow = la.ts; next = { kind: 'arrow', data: la, then: next }; }
    if (ld && ld.ts !== s.decree) { s.decree = ld.ts; next = { kind: 'decree', data: ld }; }
    // a vote that triggered the Colère du Peuple shows both: the vote first
    if (lv && lv.ts !== s.vote) { s.vote = lv.ts; next = { kind: 'vote', data: lv, then: next }; }
    if (next) setReveal(next);
  }, [gameState?.last_vote, gameState?.last_decree, gameState?.last_arrow, gameState?.last_plot]);

  // The script of each reveal: [delay in ms, step to show, sound]
  useEffect(() => {
    if (!reveal) return undefined;
    setStep(0);
    const d = reveal.data;
    const script = [];
    let end = 3600;
    if (reveal.kind === 'vote') {
      const n = Object.keys(d.ballots || {}).length;
      script.push([0, 0, 'roll']);
      for (let i = 1; i <= n; i += 1) script.push([650 + i * 330, i, 'tick']);
      const verdict = 650 + n * 330 + 750;
      script.push([verdict, n + 1, d.result === 'elected' ? 'elected' : 'rejected']);
      end = verdict + 2800;
    } else if (reveal.kind === 'decree') {
      script.push([0, 0, 'roll'], [1150, 1, d.type === 'LOYAL' ? 'loyal' : 'traitor']);
      end = 4600;
    } else if (reveal.kind === 'arrow') {
      const n = Object.keys(d.ballots || {}).length;
      for (let i = 1; i <= n; i += 1) script.push([300 + i * 280, i, 'tick']);
      const fly = 300 + n * 280 + 700;
      script.push([fly, n + 1, 'arrow'], [fly + 1300, n + 2, d.tie ? 'rejected' : d.hit ? 'loyal' : 'rejected']);
      end = fly + 1300 + 3400;
    } else if (reveal.kind === 'plot') {
      script.push([0, 0, 'plot'], [1500, 1, 'death']);
      end = 5200;
    }
    const timers = script.map(([at, st, sound]) => setTimeout(() => { setStep(st); if (sound) sfx(sound); }, at));
    timers.push(setTimeout(() => setReveal(reveal.then || null), end));
    return () => timers.forEach(clearTimeout);
  }, [reveal]);

  if (!reveal) return null;
  const players = gameState?.players || [];
  const name = (seat) => players.find((p) => p.seat === seat)?.name || `Siège ${seat}`;
  const skip = () => setReveal(reveal.then || null);
  const panel = (color) => ({
    background: 'linear-gradient(180deg, rgba(34,22,12,0.98), rgba(10,6,4,0.98))',
    border: `2px solid ${color}`,
    boxShadow: `0 0 50px ${color}77`,
  });

  if (reveal.kind === 'plot') {
    const shown = step >= 1;
    return (
      <Backdrop onSkip={skip} color="#7f1d1d">
        <div className="px-6 py-6 rounded-xl text-center do-pop" style={{ ...panel('#dc2626'), maxWidth: 440 }}>
          <div className={`text-6xl mb-3 ${shown ? 'do-stab' : 'do-breathe'}`} aria-hidden>{shown ? '🗡️' : '🌙'}</div>
          <div className="text-xs uppercase tracking-widest mb-1" style={{ fontFamily: LORA, color: 'rgba(232,217,168,0.7)' }}>Le Complot</div>
          {!shown ? (
            <div className="text-xl font-bold" style={{ fontFamily: CINZEL, color: '#fca5a5' }}>La nuit tombe sur le royaume…</div>
          ) : (
            <div className="do-pop">
              <div className="text-2xl font-bold" style={{ fontFamily: CINZEL, color: '#fca5a5' }}>{name(reveal.data.target_seat)} est assassiné</div>
              <div className="text-sm mt-2 italic" style={{ fontFamily: LORA, color: 'rgba(232,217,168,0.9)' }}>
                À l'aube, on découvre le corps. Les Traîtres ont frappé… mais qui tenait la lame ?
              </div>
            </div>
          )}
        </div>
      </Backdrop>
    );
  }

  if (reveal.kind === 'arrow') {
    const la = reveal.data;
    const ballots = Object.entries(la.ballots || {}).map(([seat, target]) => ({ seat: Number(seat), target }));
    const flying = step === ballots.length + 1;
    const done = step >= ballots.length + 2;
    const color = done && la.hit ? '#60a5fa' : GOLD;
    return (
      <Backdrop onSkip={skip} color={done && la.hit ? '#1d4ed8' : '#713f12'}>
        <div className="w-full max-w-md px-5 py-4 rounded-xl do-pop" style={panel(color)}>
          <div className="text-center mb-3">
            <div className={`text-5xl mb-1 ${flying ? 'do-fly' : ''}`} aria-hidden>🏹</div>
            <div className="text-xs uppercase tracking-widest" style={{ fontFamily: LORA, color: 'rgba(232,217,168,0.7)' }}>Flèche du Peuple</div>
            <div className="text-xl font-bold min-h-[3.5rem] flex items-center justify-center" style={{ fontFamily: CINZEL, color: done && la.hit ? '#93c5fd' : '#fde68a' }}>
              {!done ? (flying ? 'La flèche est décochée…' : 'Chacun désigne sa cible…')
                : <span className="do-stamp">{la.tie ? 'La table est divisée : la flèche se perd' : la.hit ? `${name(la.target_seat)} était le Tyran !` : `${name(la.target_seat)} n'est pas le Tyran`}</span>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {ballots.map(({ seat, target }, i) => (
              <div key={seat} className="flex items-center justify-between gap-1 px-2 py-1 rounded text-sm transition-opacity duration-300"
                style={{ opacity: step > i ? 1 : 0.12, background: 'rgba(30,20,10,0.7)', border: '1px solid rgba(199,168,105,0.3)', color: '#f5e9c8', fontFamily: LORA }}>
                <span className="truncate">{name(seat)}</span>
                <span className="truncate font-bold" style={{ color: done && target === la.target_seat ? '#fde68a' : 'rgba(232,217,168,0.8)' }}>{step > i ? `→ ${name(target)}` : '→ ?'}</span>
              </div>
            ))}
          </div>
          <Skip />
        </div>
      </Backdrop>
    );
  }

  if (reveal.kind === 'decree') {
    const loyal = reveal.data.type === 'LOYAL';
    const color = loyal ? '#3b82f6' : '#dc2626';
    const shown = step >= 1;
    return (
      <Backdrop onSkip={skip} color={shown ? (loyal ? '#1d4ed8' : '#991b1b') : '#000'}>
        <div className={`text-center ${shown && !loyal ? 'do-shake' : ''}`}>
          <div className="mx-auto mb-4" style={{ perspective: 900, width: 150, height: 210 }}>
            <div className="relative w-full h-full" style={{ transformStyle: 'preserve-3d', transition: 'transform .7s cubic-bezier(.2,.8,.2,1)', transform: shown ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
              <div className="absolute inset-0 rounded-xl flex items-center justify-center text-5xl do-breathe"
                style={{ backfaceVisibility: 'hidden', background: 'repeating-linear-gradient(45deg, #3a2410, #3a2410 8px, #2a190b 8px, #2a190b 16px)', border: `3px solid ${GOLD}`, boxShadow: '0 12px 30px rgba(0,0,0,0.8)' }}>
                📜
              </div>
              <div className="absolute inset-0 rounded-xl flex flex-col items-center justify-center gap-2"
                style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', background: loyal ? 'linear-gradient(160deg, #1e3a8a, #0b1533)' : 'linear-gradient(160deg, #7f1d1d, #1c0707)', border: `3px solid ${color}`, boxShadow: `0 0 60px ${color}` }}>
                <span className="text-6xl" aria-hidden>{loyal ? '🛡️' : '🗡️'}</span>
                <span className="text-sm font-bold uppercase tracking-widest" style={{ fontFamily: CINZEL, color: '#fff' }}>{loyal ? 'Loyal' : 'Trahison'}</span>
              </div>
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-bold min-h-[2.5rem]" style={{ fontFamily: CINZEL, color: shown ? (loyal ? '#93c5fd' : '#fca5a5') : PARCH, textShadow: '0 2px 12px #000' }}>
            {shown ? <span className="do-stamp inline-block">{loyal ? 'Décret Loyal adopté' : 'Décret de Trahison adopté'}</span> : 'Le décret est promulgué…'}
          </div>
          <div className="text-sm mt-1 italic min-h-[1.5rem]" style={{ fontFamily: LORA, color: 'rgba(232,217,168,0.9)', textShadow: '0 1px 6px #000' }}>
            {shown && (reveal.data.auto
              ? 'Imposé par la Colère du Peuple.'
              : `Par ${name(reveal.data.regent_seat)} (Roi) et ${name(reveal.data.chambellan_seat)} (Conseiller).`)}
          </div>
        </div>
      </Backdrop>
    );
  }

  const lv = reveal.data;
  const elected = lv.result === 'elected';
  const ballots = Object.entries(lv.ballots || {}).map(([seat, v]) => ({ seat: Number(seat), v }));
  const done = step >= ballots.length + 1;
  const yes = ballots.slice(0, step).filter((b) => b.v === 'oui').length;
  const no = Math.min(step, ballots.length) - yes;
  const verdictColor = elected ? '#16a34a' : '#b91c1c';
  return (
    <Backdrop onSkip={skip} color={done ? (elected ? '#166534' : '#7f1d1d') : '#000'}>
      <div className="relative w-full max-w-md px-5 py-4 rounded-xl do-pop" style={panel(done ? verdictColor : GOLD)}>
        <div className="text-center mb-3">
          <div className="text-xs uppercase tracking-widest" style={{ fontFamily: LORA, color: 'rgba(232,217,168,0.7)' }}>{done ? 'Résultat du vote' : 'Dépouillement…'}</div>
          <div className="text-sm mt-0.5" style={{ color: PARCH, fontFamily: LORA }}>👑 {name(lv.regent_seat)} · 🗝️ {name(lv.nominee_seat)}</div>
          <div className="flex items-center justify-center gap-6 mt-2 text-2xl font-bold" style={{ fontFamily: CINZEL }}>
            <span style={{ color: '#86efac' }}>{done ? lv.yes : yes} OUI</span>
            <span style={{ color: '#fca5a5' }}>{done ? lv.no : no} NON</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {ballots.map(({ seat, v }, i) => {
            const open = step > i;
            return (
              <div key={seat} className={`flex items-center justify-between px-2 py-1 rounded text-sm ${open ? 'do-pop' : ''}`}
                style={{
                  fontFamily: LORA, color: '#f5e9c8',
                  background: !open ? 'rgba(30,20,10,0.7)' : v === 'oui' ? 'rgba(22,101,52,0.4)' : 'rgba(127,29,29,0.4)',
                  border: `1px solid ${!open ? 'rgba(199,168,105,0.3)' : v === 'oui' ? 'rgba(134,239,172,0.5)' : 'rgba(252,165,165,0.5)'}`,
                }}>
                <span className="truncate">{name(seat)}</span>
                <span className="font-bold" style={{ color: !open ? 'rgba(232,217,168,0.5)' : v === 'oui' ? '#86efac' : '#fca5a5' }}>{!open ? '?' : v === 'oui' ? 'OUI' : 'NON'}</span>
              </div>
            );
          })}
        </div>
        {!ballots.length && <p className="text-center text-sm italic" style={{ color: PARCH, fontFamily: LORA }}>Personne ne pouvait voter : le gouvernement est installé d'office.</p>}
        {done && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="do-stamp px-5 py-2 rounded-lg text-3xl md:text-4xl font-bold uppercase"
              style={{ fontFamily: CINZEL, color: elected ? '#bbf7d0' : '#fecaca', border: `4px solid ${verdictColor}`, background: 'rgba(10,6,4,0.88)', transform: 'rotate(-7deg)', letterSpacing: '0.12em', boxShadow: `0 0 40px ${verdictColor}` }}>
              {elected ? 'Élu' : 'Rejeté'}
            </span>
          </div>
        )}
        <Skip />
      </div>
    </Backdrop>
  );
};

// ---------------------------------------------------------------------
// End-of-game recap: awards + decree timeline + how everyone voted
// ---------------------------------------------------------------------
const ROLE_TXT = { LOYAL: ['Fidèle', '#93c5fd'], CONJURE: ['Traître', '#fca5a5'], USURPATEUR: ['Tyran', '#d8b4fe'] };

export const Recap = ({ gameState }) => {
  const recap = gameState?.recap;
  if (!recap) return null;
  const players = gameState.players || [];
  const name = (seat) => players.find((p) => p.seat === seat)?.name || '—';
  const box = { background: 'rgba(20,14,8,0.6)', border: '1px solid rgba(199,168,105,0.3)' };
  const title = (txt) => (
    <div className="text-[10px] uppercase tracking-widest mb-2" style={{ color: 'rgba(232,217,168,0.7)', fontFamily: LORA }}>{txt}</div>
  );
  return (
    <div className="space-y-3">
      {recap.awards?.length > 0 && (
        <div className="p-3 rounded-lg" style={box}>
          {title('✦ Distinctions de la partie')}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {recap.awards.map((a, i) => {
              const role = ROLE_TXT[players.find((p) => p.seat === a.seat)?.role];
              return (
                <div key={a.key} className="flex items-center gap-2 rounded-lg px-2 py-1.5 do-pop" style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(199,168,105,0.25)', animationDelay: `${i * 0.12}s` }}>
                  <span className="text-2xl" aria-hidden>{a.icon}</span>
                  <span className="min-w-0">
                    <span className="block text-xs font-bold uppercase tracking-wider" style={{ color: '#fde68a', fontFamily: LORA }}>{a.title}</span>
                    <span className="block text-sm font-semibold truncate" style={{ color: role ? role[1] : PARCH, fontFamily: LORA }}>{a.name}</span>
                    <span className="block text-[11px] leading-tight" style={{ color: 'rgba(232,217,168,0.7)', fontFamily: LORA }}>{a.detail}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {recap.decrees?.length > 0 && (
        <div className="p-3 rounded-lg" style={box}>
          {title(`✦ Le fil de la partie · ${recap.turns} tours`)}
          <ol className="space-y-1">
            {recap.decrees.map((d, i) => {
              const loyal = d.type === 'LOYAL';
              return (
                <li key={i} className="flex items-center gap-2 text-xs" style={{ fontFamily: LORA, color: PARCH }}>
                  <span className="w-12 shrink-0 opacity-60">Tour {d.turn}</span>
                  <span className="w-6 h-6 shrink-0 rounded flex items-center justify-center" style={{ background: loyal ? '#1d4ed8' : '#b91c1c' }} aria-hidden>{loyal ? '🛡️' : '🗡️'}</span>
                  <span className="min-w-0 truncate">
                    <b style={{ color: loyal ? '#93c5fd' : '#fca5a5' }}>{loyal ? 'Loyal' : 'Trahison'}</b>
                    {d.auto ? ' · imposé par le peuple' : ` · 👑 ${name(d.regent_seat)} + 🗝️ ${name(d.chambellan_seat)}`}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
};

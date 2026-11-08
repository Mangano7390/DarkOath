// "La Salle du Trône" — the game room's main visuals:
//   * IdentityBar : who am I, what is my secret role, who are my allies
//   * TurnSteps   : where we are in the turn, in plain words, and what to do
//   * CourtTable  : the table — every player as a readable card around the
//                   decree board, with King / Conseiller / votes / deaths
import React, { useEffect, useState } from 'react';
import { POWER_ICONS, POWER_LABELS } from '../lib/game';

const CINZEL = "'Cinzel', serif";
const FELL = "'IM Fell English', serif";
const GOLD = '#c7a869';
const PARCH = '#e8d9a8';

export const ROLE_STYLE = {
  LOYAL: { name: 'Fidèle', icon: '🛡️', color: '#60a5fa', bg: 'rgba(30, 58, 138, 0.35)', goal: 'Faites adopter 5 Décrets Loyaux ou exécutez le Tyran.' },
  CONJURE: { name: 'Traître', icon: '⚔️', color: '#f87171', bg: 'rgba(127, 29, 29, 0.4)', goal: '6 Décrets de Trahison, ou le Tyran élu Conseiller après 3 Trahisons.' },
  USURPATEUR: { name: 'Tyran', icon: '👑', color: '#c084fc', bg: 'rgba(88, 28, 135, 0.4)', goal: 'Restez caché, puis faites-vous élire Conseiller après 3 Trahisons.' },
};

export const useMedia = (query) => {
  const [match, setMatch] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener ? mq.addEventListener('change', on) : mq.addListener(on);
    return () => (mq.removeEventListener ? mq.removeEventListener('change', on) : mq.removeListener(on));
  }, [query]);
  return match;
};

const nameOf = (players, seat) => players.find((p) => p.seat === seat)?.name || `Siège ${seat}`;

// ---------------------------------------------------------------------
// Identity bar
// ---------------------------------------------------------------------
export const IdentityBar = ({ me, role, teammates = [], compact = false }) => {
  const [open, setOpen] = useState(false);
  const r = ROLE_STYLE[role];
  if (!me || !r) return null;
  return (
    <div className="px-3 py-2 flex items-center gap-3 flex-wrap" style={{ background: 'rgba(10, 6, 4, 0.85)', borderBottom: '1px solid rgba(199,168,105,0.2)' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full pl-1 pr-3 py-1 transition-colors"
        style={{ background: r.bg, border: `1px solid ${r.color}` }}
        aria-expanded={open}
        title="Mon rôle secret"
      >
        <span className="w-7 h-7 rounded-full flex items-center justify-center text-base" style={{ background: 'rgba(0,0,0,0.45)' }}>{r.icon}</span>
        <span className="text-xs uppercase tracking-widest" style={{ fontFamily: CINZEL, color: PARCH }}>
          Vous êtes <strong style={{ color: r.color }}>{r.name}</strong>
        </span>
      </button>
      {!compact && (
        <span className="text-xs italic" style={{ color: 'rgba(232,217,168,0.75)', fontFamily: FELL }}>{r.goal}</span>
      )}
      {teammates.length > 0 && (
        <span className="flex items-center gap-1.5 flex-wrap text-xs" style={{ color: 'rgba(232,217,168,0.8)' }}>
          <span className="uppercase tracking-widest text-[10px]" style={{ fontFamily: CINZEL }}>Vos alliés :</span>
          {teammates.map((t) => (
            <span key={t.seat} className="px-2 py-0.5 rounded-full" style={{
              background: 'rgba(0,0,0,0.45)',
              border: `1px solid ${ROLE_STYLE[t.role]?.color || GOLD}`,
              color: ROLE_STYLE[t.role]?.color || PARCH,
            }}>
              {ROLE_STYLE[t.role]?.icon} {t.name}
            </span>
          ))}
        </span>
      )}
      {open && (
        <div className="w-full text-xs leading-relaxed pt-1" style={{ color: 'rgba(232,217,168,0.85)' }}>
          <strong style={{ color: r.color }}>{r.name} — </strong>{r.goal}{' '}
          {role === 'LOYAL' && 'Vous ne connaissez personne : observez les votes, les décrets et qui ment.'}
          {role === 'CONJURE' && 'Vous connaissez vos alliés (en rouge et violet sur la table). Mentez avec prudence.'}
          {role === 'USURPATEUR' && (teammates.length ? 'Votre Traître vous connaît : laissez-le vous porter au pouvoir.' : 'Vous ne connaissez personne, mais les Traîtres vous connaissent.')}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------
// Turn steps + plain-language narration
// ---------------------------------------------------------------------
const STEPS = [
  { key: 'NOMINATION', label: 'Nomination', icon: '👑' },
  { key: 'VOTE', label: 'Vote', icon: '🗳️' },
  { key: 'LEGIS', label: 'Décret', icon: '📜' },
  { key: 'CONSEIL_ROYAUME', label: 'Débat', icon: '🕯️' },
  { key: 'POWER', label: 'Pouvoir', icon: '⚜️' },
];

const stepOf = (phase) => (phase === 'LEGIS_REGENT' || phase === 'LEGIS_CHAMBELLAN' ? 'LEGIS' : phase);

export const narrate = (gs, me) => {
  const players = gs.players || [];
  const king = nameOf(players, gs.regent_seat);
  const nominee = gs.nominee_seat ? nameOf(players, gs.nominee_seat) : null;
  const iAmKing = me?.seat === gs.regent_seat;
  const iAmNominee = me?.seat === gs.nominee_seat;
  const alive = players.filter((p) => p.alive);
  const voted = (gs.votes_cast || []).length;
  const voterCount = alive.filter((p) => p.seat !== gs.regent_seat && p.seat !== gs.nominee_seat).length;
  const d = gs.last_decree;
  switch (gs.phase) {
    case 'NOMINATION':
      return iAmKing
        ? { text: 'Vous êtes le Roi. Choisissez votre Conseiller : cliquez sur un joueur autour de la table.', mine: true }
        : { text: `${king} est le Roi. Il choisit un Conseiller pour former un gouvernement.` };
    case 'VOTE':
      return {
        text: iAmKing || iAmNominee
          ? `${iAmKing ? `Vous proposez ${nominee}` : `${king} vous propose`} comme Conseiller. Le gouvernement ne vote pas : la table décide (${voted}/${voterCount} ont voté). Plaidez votre cause dans le chat !`
          : `${king} propose ${nominee} comme Conseiller. Les autres joueurs votent OUI ou NON (${voted}/${voterCount} ont voté). Bulletins révélés à la fin.`,
        mine: me?.alive !== false && !iAmKing && !iAmNominee && !(gs.votes_cast || []).includes(me?.id),
      };
    case 'LEGIS_REGENT':
      return iAmKing
        ? { text: 'Gouvernement élu ! Vous piochez 3 décrets : écartez-en 1 en secret, les 2 autres vont au Conseiller.', mine: true }
        : { text: `Gouvernement élu. ${king} regarde 3 décrets en secret et en écarte 1.` };
    case 'LEGIS_CHAMBELLAN':
      if (gs.veto_requested) {
        return iAmKing
          ? { text: `${nominee} demande le veto. Acceptez-vous de jeter les deux décrets ?`, mine: true }
          : { text: `${nominee} demande le veto. ${king} décide.` };
      }
      return iAmNominee
        ? { text: 'Vous recevez 2 décrets du Roi : adoptez-en 1, l\'autre est défaussé en secret.', mine: true }
        : { text: `${nominee} reçoit 2 décrets et en adopte 1. Personne ne voit les cartes.` };
    case 'CONSEIL_ROYAUME':
      return {
        text: d
          ? `Décret ${d.type === 'LOYAL' ? 'Loyal 🛡️' : 'de Trahison ⚔️'} adopté. Débattez : le Roi et le Conseiller annoncent leurs cartes… qui ment ?`
          : 'Débattez dans le chat et au micro.',
      };
    case 'POWER':
      return iAmKing
        ? { text: `Pouvoir du Roi : ${POWER_LABELS[gs.active_power] || ''}. ${gs.active_power === 'PEEK' ? 'Regardez la pioche.' : 'Cliquez sur un joueur autour de la table.'}`, mine: true }
        : { text: `${king} utilise son pouvoir : ${POWER_LABELS[gs.active_power] || ''} ${POWER_ICONS[gs.active_power] || ''}.` };
    case 'ENDGAME':
      return { text: 'La partie est terminée. Les rôles sont révélés.' };
    default:
      return { text: '' };
  }
};

// One short tactical tip for the current phase, depending on my role
const tipFor = (gs, me, role) => {
  if (!me || me.alive === false || !role) return null;
  const evil = role === 'CONJURE';
  const t3 = (gs.tracks?.conjure || 0) >= 3;
  switch (gs.phase) {
    case 'NOMINATION':
      return evil ? 'Astuce : un Roi Traître peut nommer un allié… mais trop souvent, ça se voit.'
        : 'Astuce : nommez quelqu\'un qui a déjà fait passer un Décret Loyal.';
    case 'VOTE':
      if (me.seat === gs.regent_seat || me.seat === gs.nominee_seat) return 'Astuce : vous ne votez pas, mais le chat compte. Expliquez pourquoi ce gouvernement est fiable.';
      if (t3 && !evil && role !== 'USURPATEUR') return 'Attention : 3 Trahisons. Si ce Conseiller est le Tyran, les Traîtres gagnent. Votez NON au moindre doute.';
      if ((gs.tracks?.crisis || 0) >= 2) return 'La Colère du Peuple est à 2 : un nouveau rejet impose le décret du dessus de la pioche.';
      return evil ? 'Astuce : soutenez les gouvernements de vos alliés, sans voter toujours comme eux.'
        : 'Astuce : votez NON si vous soupçonnez le Roi ou le Conseiller proposé.';
    case 'CONSEIL_ROYAUME':
      return evil ? 'Astuce : si vous étiez au gouvernement, annoncez des cartes crédibles.'
        : 'Astuce : comparez les annonces du Roi et du Conseiller. S\'ils se contredisent, l\'un des deux ment.';
    default:
      return null;
  }
};

export const TurnSteps = ({ gameState, me, role, compact = false }) => {
  const gs = gameState;
  if (!gs || gs.phase === 'ENDGAME') return null;
  const current = stepOf(gs.phase);
  const n = narrate(gs, me);
  const tip = tipFor(gs, me, role);
  const steps = STEPS.filter((s) => s.key !== 'POWER' || gs.phase === 'POWER');
  return (
    <div className="px-3 py-2" style={{ background: 'linear-gradient(180deg, rgba(30,20,12,0.92), rgba(15,10,6,0.92))', borderBottom: '1px solid rgba(199,168,105,0.25)' }}>
      <div className="max-w-7xl mx-auto">
        <ol className="flex items-center gap-1 overflow-x-auto" aria-label="Étapes du tour">
          <li className="text-[10px] uppercase tracking-widest mr-2 shrink-0" style={{ fontFamily: CINZEL, color: 'rgba(232,217,168,0.6)' }}>
            Tour {gs.turn_number}
          </li>
          {steps.map((s, i) => {
            const active = s.key === current;
            const done = steps.findIndex((x) => x.key === current) > i;
            return (
              <li key={s.key} className="flex items-center gap-1 shrink-0">
                <span
                  className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] uppercase tracking-wider"
                  style={{
                    fontFamily: CINZEL,
                    background: active ? 'rgba(199,168,105,0.95)' : done ? 'rgba(199,168,105,0.18)' : 'rgba(0,0,0,0.35)',
                    color: active ? '#1a1008' : done ? PARCH : 'rgba(232,217,168,0.45)',
                    border: `1px solid ${active ? GOLD : 'rgba(199,168,105,0.25)'}`,
                    fontWeight: active ? 700 : 400,
                  }}
                  aria-current={active ? 'step' : undefined}
                >
                  <span aria-hidden>{done ? '✓' : s.icon}</span>{(!compact || active) && s.label}
                </span>
                {i < steps.length - 1 && <span className="w-3 h-px" style={{ background: 'rgba(199,168,105,0.35)' }} />}
              </li>
            );
          })}
        </ol>
        <p className="mt-1.5 text-sm leading-snug" style={{ color: n.mine ? '#fde68a' : PARCH }}>
          {n.mine && <strong className="mr-1">➜</strong>}{n.text}
        </p>
        {tip && !compact && (
          <p className="text-xs italic mt-0.5" style={{ color: 'rgba(232,217,168,0.6)', fontFamily: FELL }}>{tip}</p>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// Decree board (center of the table)
// ---------------------------------------------------------------------
export const DecreeBoard = ({ gameState, small = false }) => {
  const t = gameState.tracks || {};
  const board = gameState.power_board || {};
  const box = small ? 22 : 30;
  const row = (count, max, color, marks, label, labelColor) => (
    <div className="flex items-center gap-2">
      <span className="text-[10px] uppercase tracking-widest w-16 text-right shrink-0 font-bold" style={{ fontFamily: CINZEL, color: labelColor }}>{label}</span>
      <div className="flex gap-1">
        {Array.from({ length: max }, (_, i) => {
          const filled = i < count;
          return (
            <span key={i} className="rounded flex items-center justify-center" style={{
              width: box, height: box, fontSize: small ? 11 : 14,
              background: filled ? color : 'rgba(10,6,4,0.75)',
              border: `1px solid ${filled ? color : 'rgba(199,168,105,0.3)'}`,
              boxShadow: filled ? `0 0 8px ${color}` : 'none',
              opacity: filled ? 1 : 0.85,
            }} title={!filled && marks[i + 1] ? marks[i + 1].title : undefined}>
              {filled ? '' : marks[i + 1]?.icon || ''}
            </span>
          );
        })}
      </div>
    </div>
  );
  const tMarks = { 6: { icon: '☠️', title: '6 Trahisons : victoire des Traîtres' } };
  Object.entries(board).forEach(([slot, p]) => { tMarks[Number(slot)] = { icon: POWER_ICONS[p], title: POWER_LABELS[p] }; });
  const lMarks = { 5: { icon: '🏆', title: '5 Loyaux : victoire des Fidèles' } };
  return (
    <div className="flex flex-col items-center gap-1.5">
      {row(t.loyal || 0, 5, '#3b82f6', lMarks, 'Loyaux', '#93c5fd')}
      {row(t.conjure || 0, 6, '#dc2626', tMarks, 'Trahisons', '#fca5a5')}
      <div className="flex items-center gap-3 text-[11px] mt-0.5" style={{ color: 'rgba(232,217,168,0.75)' }}>
        <span title="Gouvernements rejetés d'affilée : à 3, le peuple impose un décret">
          ⚡ Colère{' '}
          {Array.from({ length: 3 }, (_, i) => (
            <span key={i} className="inline-block rounded-full align-middle mx-0.5" style={{
              width: 9, height: 9, background: i < (t.crisis || 0) ? '#f59e0b' : 'rgba(10,6,4,0.8)', border: '1px solid rgba(245,158,11,0.6)',
            }} />
          ))}
        </span>
        <span title="Décrets restants dans la pioche">📜 {gameState.deck_count ?? '—'}</span>
        {(t.conjure || 0) >= 3 && <span style={{ color: '#c084fc' }} title="Élire le Tyran Conseiller fait gagner les Traîtres">👑 Tyran = danger</span>}
        {gameState.veto_unlocked && <span title="Le Conseiller peut demander le veto">✋ Veto</span>}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// Player card
// ---------------------------------------------------------------------
const Chip = ({ children, color = PARCH, bg = 'rgba(0,0,0,0.55)', title }) => (
  <span title={title} className="px-1.5 py-px rounded text-[9px] uppercase tracking-wider whitespace-nowrap" style={{ color, background: bg, border: `1px solid ${color}55`, fontFamily: CINZEL }}>
    {children}
  </span>
);

export const SeatCard = ({ p, gs, me, teammates, selectable, onSelect, width = 116 }) => {
  const isMe = p.id === me?.id;
  const ally = teammates.find((t) => t.seat === p.seat);
  const revealed = p.role ? ROLE_STYLE[p.role] : null;
  const known = isMe ? ROLE_STYLE[gs.your_role] : ally ? ROLE_STYLE[ally.role] : revealed;
  const isKing = p.seat === gs.regent_seat;
  const ld = gs.last_decree;
  const justGoverned = ld && !ld.auto && ld.turn === gs.turn_number && ['CONSEIL_ROYAUME', 'POWER'].includes(gs.phase);
  const isNominee = (p.seat === gs.nominee_seat && ['VOTE', 'LEGIS_REGENT', 'LEGIS_CHAMBELLAN'].includes(gs.phase))
    || (justGoverned && p.seat === ld.chambellan_seat);
  const elected = isNominee && gs.phase !== 'VOTE';
  const lv = gs.last_vote;
  const ballot = lv && lv.turn === gs.turn_number && gs.phase !== 'VOTE' ? lv.ballots?.[String(p.seat)] : null;
  const hasVoted = gs.phase === 'VOTE' && (gs.votes_cast || []).includes(p.id);
  const ineligible = gs.phase === 'NOMINATION' && p.alive && !isKing && !(gs.eligible_nominee_seats || []).includes(p.seat);
  const dead = !p.alive;
  const ring = selectable ? '#fde68a' : isKing ? GOLD : isNominee ? '#d6b56a' : known ? known.color : 'rgba(199,168,105,0.35)';

  const role = isKing ? { text: '👑 Roi', color: '#1a1008', bg: GOLD }
    : isNominee ? { text: elected ? '📜 Conseiller' : '📜 Proposé', color: '#1a1008', bg: '#d6b56a' }
      : gs.special_next_seat === p.seat ? { text: '👑 Prochain Roi', color: '#1a1008', bg: '#a3a3a3' } : null;

  const Tag = selectable ? 'button' : 'div';
  return (
    <Tag
      type={selectable ? 'button' : undefined}
      onClick={selectable ? () => onSelect(p.seat) : undefined}
      className={`relative flex flex-col items-center text-center rounded-xl px-1.5 pt-3 pb-1.5 transition-all ${selectable ? 'cursor-pointer hover:scale-105 seat-selectable' : ''}`}
      style={{
        width,
        background: isMe ? 'linear-gradient(180deg, rgba(90,62,20,0.85), rgba(25,16,8,0.95))' : 'linear-gradient(180deg, rgba(40,28,16,0.92), rgba(15,10,6,0.95))',
        border: `${isKing || isMe || selectable ? 2 : 1}px solid ${ring}`,
        boxShadow: selectable ? '0 0 14px rgba(253,230,138,0.65)' : isKing ? '0 0 14px rgba(199,168,105,0.5)' : '0 2px 8px rgba(0,0,0,0.6)',
        filter: dead ? 'grayscale(1)' : 'none',
        opacity: dead ? 0.55 : ineligible ? 0.6 : 1,
      }}
      aria-label={`${p.name}${isMe ? ' (vous)' : ''}${isKing ? ', Roi' : ''}${isNominee ? ', Conseiller' : ''}${dead ? ', mort' : ''}`}
    >
      {role && (
        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 py-px rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap" style={{ background: role.bg, color: role.color, fontFamily: CINZEL, boxShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>
          {role.text}
        </span>
      )}
      <span className="relative w-10 h-10 rounded-full flex items-center justify-center text-base font-bold mb-1" style={{
        background: known ? known.bg : 'rgba(0,0,0,0.5)',
        border: `2px solid ${known ? known.color : 'rgba(199,168,105,0.4)'}`,
        color: known ? known.color : PARCH,
        fontFamily: CINZEL,
      }}>
        {dead ? '💀' : known ? known.icon : (p.name || '?').replace(/^(Sire|Dame|Frère|Baron|Comtesse|Messire|Abbesse|Chevalier)\s+/i, '').charAt(0).toUpperCase()}
        <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full text-[9px] flex items-center justify-center" style={{ background: '#1a1008', border: `1px solid ${GOLD}`, color: PARCH }}>{p.seat}</span>
      </span>
      <span className="text-[12px] leading-tight font-semibold line-clamp-2 w-full" style={{ color: isMe ? '#fde68a' : PARCH, fontFamily: CINZEL }}>
        {p.name}
      </span>
      <span className="flex flex-wrap justify-center gap-0.5 mt-1 min-h-[14px]">
        {isMe && <Chip color="#fde68a">Vous</Chip>}
        {ally && <Chip color={ROLE_STYLE[ally.role].color}>{ally.role === 'USURPATEUR' ? 'Tyran' : 'Allié'}</Chip>}
        {revealed && !isMe && !ally && <Chip color={revealed.color}>{revealed.name}</Chip>}
        {p.is_bot && <Chip color="#94a3b8" title="Joueur contrôlé par l'ordinateur">Bot</Chip>}
        {dead && <Chip color="#a3a3a3">Mort</Chip>}
        {!dead && p.connected === false && !p.is_bot && <Chip color="#a3a3a3" title="Absent : le destin jouera pour lui">Absent</Chip>}
        {gs.phase === 'VOTE' && p.alive && !isKing && !isNominee && (hasVoted ? <Chip color="#86efac">✓ a voté</Chip> : <Chip color="rgba(232,217,168,0.55)">vote…</Chip>)}
        {ballot && <Chip color={ballot === 'oui' ? '#86efac' : '#fca5a5'} bg={ballot === 'oui' ? 'rgba(22,101,52,0.6)' : 'rgba(127,29,29,0.6)'} title="Son vote pour le dernier gouvernement">{ballot === 'oui' ? 'Oui' : 'Non'}</Chip>}
        {ineligible && <Chip color="rgba(232,217,168,0.6)" title="Était au dernier gouvernement : ne peut pas être Conseiller">🔒 Exclu</Chip>}
        {(gs.investigated_seats || []).includes(p.seat) && !dead && <Chip color="#fbbf24" title="A déjà fait l'objet d'une enquête">🔍</Chip>}
      </span>
      {selectable && (
        <span className="mt-1 text-[10px] uppercase tracking-widest font-bold" style={{ color: '#fde68a', fontFamily: CINZEL }}>Choisir</span>
      )}
    </Tag>
  );
};

// ---------------------------------------------------------------------
// The table: cards around an oval (desktop) or a grid (mobile)
// ---------------------------------------------------------------------
export const CourtTable = ({ gameState, me, selectableSeats = [], onSelect, layout = 'ring', selectHint }) => {
  const gs = gameState;
  const players = [...(gs.players || [])].sort((a, b) => a.seat - b.seat);
  const teammates = gs.teammates || [];
  const n = players.length || 1;
  const myIndex = Math.max(0, players.findIndex((p) => p.id === me?.id));

  if (layout === 'grid') {
    return (
      <div className="w-full space-y-3">
        <div className="rounded-xl p-3" style={{ background: 'radial-gradient(ellipse at center, rgba(70,45,20,0.6), rgba(15,10,6,0.9))', border: '1px solid rgba(199,168,105,0.3)' }}>
          <DecreeBoard gameState={gs} small />
        </div>
        {selectHint && <p className="text-center text-xs font-semibold" style={{ color: '#fde68a' }}>{selectHint}</p>}
        <div className="grid grid-cols-3 gap-2 justify-items-center pt-2">
          {players.map((p) => (
            <SeatCard key={p.id} p={p} gs={gs} me={me} teammates={teammates} width="100%"
              selectable={selectableSeats.includes(p.seat)} onSelect={onSelect} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full mx-auto" style={{ maxWidth: 820, aspectRatio: '16 / 11', minHeight: 440 }}>
      {/* the table */}
      <div className="absolute rounded-[50%] flex flex-col items-center justify-center" style={{
        left: '16%', right: '16%', top: '20%', bottom: '20%',
        background: 'radial-gradient(ellipse at 50% 40%, #5a3a1c 0%, #3a2410 55%, #1c1108 100%)',
        border: '6px solid #2a190b',
        boxShadow: 'inset 0 0 40px rgba(0,0,0,0.75), 0 0 0 2px rgba(199,168,105,0.35), 0 20px 40px rgba(0,0,0,0.6)',
      }}>
        <DecreeBoard gameState={gs} />
        {selectHint && <p className="mt-2 text-sm font-semibold px-3 text-center animate-pulse" style={{ color: '#fde68a', fontFamily: CINZEL }}>{selectHint}</p>}
      </div>
      {/* the players, me always at the front */}
      {players.map((p, i) => {
        const angle = Math.PI / 2 + ((i - myIndex) * 2 * Math.PI) / n;
        const x = 50 + 41 * Math.cos(angle);
        const y = 50 + 39 * Math.sin(angle);
        return (
          <div key={p.id} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${x}%`, top: `${y}%` }}>
            <SeatCard p={p} gs={gs} me={me} teammates={teammates}
              selectable={selectableSeats.includes(p.seat)} onSelect={onSelect} />
          </div>
        );
      })}
    </div>
  );
};

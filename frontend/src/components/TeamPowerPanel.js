// Pouvoirs de camp : Flèche du Peuple (toute la table) et Complot (Traîtres).
import React, { useEffect, useState } from 'react';

const CINZEL = "'Cinzel', serif";
const FELL = "'IM Fell English', serif";
const PARCH = '#e8d9a8';
const GOLD = '#c7a869';

const Header = ({ icon, title, color, children }) => (
  <div className="p-3 rounded-lg" style={{ background: `linear-gradient(180deg, ${color}26, rgba(10,6,4,0.85))`, border: `1px solid ${color}88`, boxShadow: `0 0 18px ${color}33` }}>
    <div className="flex items-center gap-2 mb-1">
      <span className="text-2xl" aria-hidden>{icon}</span>
      <span className="font-bold uppercase tracking-widest text-sm" style={{ fontFamily: CINZEL, color }}>{title}</span>
    </div>
    <p className="text-sm leading-snug" style={{ color: PARCH, fontFamily: FELL }}>{children}</p>
  </div>
);

const Candidate = ({ p, selected, onClick, disabled, note }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="flex items-center gap-2 w-full text-left rounded-lg px-3 py-2 transition-colors disabled:opacity-50"
    style={{
      background: selected ? 'rgba(199,168,105,0.28)' : 'rgba(20,14,8,0.65)',
      border: `${selected ? 2 : 1}px solid ${selected ? '#fde68a' : 'rgba(199,168,105,0.35)'}`,
      color: PARCH,
    }}
    aria-pressed={selected}
  >
    <span className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: 'rgba(199,168,105,0.18)', border: `1px solid ${GOLD}`, fontFamily: CINZEL }}>{p.seat}</span>
    <span className="flex-1 min-w-0">
      <span className="block truncate font-semibold" style={{ fontFamily: CINZEL }}>{p.name}</span>
      {note && <span className="block text-xs italic" style={{ color: 'rgba(232,217,168,0.7)' }}>{note}</span>}
    </span>
    {selected && <span aria-hidden>🎯</span>}
  </button>
);

const TeamPowerPanel = ({ gameState: gs, me, pending, onAction }) => {
  const [choice, setChoice] = useState(null);
  const phase = gs.phase;
  useEffect(() => { setChoice(null); }, [phase, gs.turn_number]);

  const players = gs.players || [];
  const nameOf = (seat) => players.find((p) => p.seat === Number(seat))?.name || `Siège ${seat}`;
  const alive = players.filter((p) => p.alive);
  const iAmAlive = me && me.alive !== false;
  const cleared = gs.not_tyran_seats || [];

  if (phase === 'JUGEMENT') {
    const voted = gs.arrow_voted_ids || [];
    const myTarget = gs.arrow_my_target;
    const candidates = alive.filter((p) => p.seat !== me?.seat);
    return (
      <div className="space-y-3">
        <Header icon="🏹" title="La Flèche du Peuple" color="#60a5fa">
          Trois Décrets Loyaux : le peuple a droit à <b>une seule flèche</b>. Chacun désigne celui qu'il croit être le <b>Tyran</b>.
          Le joueur le plus désigné est visé : si c'est le Tyran, <b>les Fidèles gagnent</b> ; sinon, il est innocenté.
          Les choix sont révélés quand tout le monde a tiré.
        </Header>
        <div className="text-xs text-center" style={{ color: 'rgba(232,217,168,0.75)' }}>
          {voted.length}/{alive.length} ont désigné leur cible · débattez dans le chat !
        </div>
        {!iAmAlive ? (
          <p className="text-sm italic text-center" style={{ color: 'rgba(232,217,168,0.7)' }}>Les morts regardent la flèche partir…</p>
        ) : myTarget ? (
          <div className="p-3 rounded-lg text-center text-sm" style={{ background: 'rgba(20,14,8,0.6)', border: '1px solid rgba(199,168,105,0.3)', color: PARCH }}>
            🎯 Vous visez <b>{nameOf(myTarget)}</b>. En attente des autres joueurs…
          </div>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 gap-2">
              {candidates.map((p) => (
                <Candidate key={p.seat} p={p} selected={choice === p.seat} disabled={pending}
                  note={cleared.includes(p.seat) ? 'Déjà innocenté : n\'est pas le Tyran' : null}
                  onClick={() => setChoice(p.seat)} />
              ))}
            </div>
            <button
              type="button"
              disabled={!choice || pending}
              onClick={() => onAction('ARROW_VOTE', { targetSeat: choice })}
              className="w-full py-3 rounded-lg font-bold uppercase tracking-widest disabled:opacity-40"
              style={{ fontFamily: CINZEL, background: 'linear-gradient(180deg, #93c5fd, #2563eb)', color: '#06122b', boxShadow: '0 0 14px rgba(96,165,250,0.45)' }}
            >
              {choice ? `🏹 Viser ${nameOf(choice)}` : 'Choisissez une cible'}
            </button>
          </>
        )}
      </div>
    );
  }

  if (phase === 'COMPLOT') {
    const iAmTraitor = gs.your_role === 'CONJURE' && iAmAlive;
    if (!iAmTraitor) {
      return (
        <div className="space-y-3">
          <Header icon="🌙" title="Le Complot" color="#f87171">
            Deux Décrets de Trahison : la nuit tombe sur le royaume. Les Traîtres choisissent <b>en secret</b> un Fidèle à abattre.
            {gs.your_role === 'USURPATEUR'
              ? ' Vos alliés vous connaissent : ils ne frapperont pas le Tyran.'
              : ' Au matin, observez qui se réjouit un peu trop…'}
          </Header>
          <div className="text-center text-4xl py-4 animate-pulse" aria-hidden>🕯️</div>
        </div>
      );
    }
    const allies = (gs.teammates || []).map((t) => t.seat);
    const victims = alive.filter((p) => p.seat !== me.seat && !allies.includes(p.seat));
    const picks = gs.plot_votes || {};
    const mine = picks[String(me.seat)];
    return (
      <div className="space-y-3">
        <Header icon="🗡️" title="Le Complot" color="#f87171">
          Choisissez le Fidèle à abattre cette nuit. Personne ne saura qui tenait la lame.
          {(gs.teammates || []).some((t) => t.role === 'CONJURE') && ' Vos complices voient votre choix : en cas de désaccord, la majorité l\'emporte.'}
        </Header>
        {Object.keys(picks).length > 0 && (
          <div className="text-xs space-y-0.5" style={{ color: '#fca5a5' }}>
            {Object.entries(picks).map(([seat, target]) => (
              <div key={seat}>🗡️ {Number(seat) === me.seat ? 'Vous visez' : `${nameOf(seat)} vise`} <b>{nameOf(target)}</b></div>
            ))}
          </div>
        )}
        {mine ? (
          <p className="text-sm text-center italic" style={{ color: PARCH }}>Votre lame est prête. En attente de vos complices…</p>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 gap-2">
              {victims.map((p) => (
                <Candidate key={p.seat} p={p} selected={choice === p.seat} disabled={pending} onClick={() => setChoice(p.seat)} />
              ))}
            </div>
            <button
              type="button"
              disabled={!choice || pending}
              onClick={() => onAction('PLOT_VOTE', { targetSeat: choice })}
              className="w-full py-3 rounded-lg font-bold uppercase tracking-widest disabled:opacity-40"
              style={{ fontFamily: CINZEL, background: 'linear-gradient(180deg, #f87171, #991b1b)', color: '#1a0505', boxShadow: '0 0 14px rgba(248,113,113,0.45)' }}
            >
              {choice ? `🗡️ Abattre ${nameOf(choice)}` : 'Choisissez une victime'}
            </button>
          </>
        )}
      </div>
    );
  }
  return null;
};

export default TeamPowerPanel;

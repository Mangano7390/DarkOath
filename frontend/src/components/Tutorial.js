// Tutoriel pas à pas : 13 écrans courts, chacun avec un visuel,
// une démonstration (tirage des décrets jouable) et un quiz final.
import React, { useCallback, useEffect, useRef, useState } from 'react';

const CINZEL = "'Cinzel', serif";
const FELL = "'IM Fell English', serif";
const GOLD = '#c7a869';
const PARCH = '#e8d9a8';
const BLUE = '#60a5fa';
const RED = '#f87171';
const PURPLE = '#c084fc';
const DONE_KEY = 'darkoath_tuto_done';

export const tutorialDone = () => {
  try { return localStorage.getItem(DONE_KEY) === '1'; } catch { return false; }
};

// ---------------------------------------------------------------------
// Small visual building blocks
// ---------------------------------------------------------------------
const Panel = ({ children, className = '', style }) => (
  <div className={`rounded-xl p-4 ${className}`} style={{ background: 'rgba(14, 9, 6, 0.75)', border: '1px solid rgba(199,168,105,0.28)', ...style }}>
    {children}
  </div>
);

const Chip = ({ children, color = PARCH, bg = 'rgba(0,0,0,0.55)' }) => (
  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider whitespace-nowrap"
    style={{ color, background: bg, border: `1px solid ${color}55`, fontFamily: CINZEL }}>
    {children}
  </span>
);

const Seat = ({ name, seat, badge, chips = [], glow, dim, ring = 'rgba(199,168,105,0.35)', w = 104 }) => (
  <div className="relative flex flex-col items-center text-center rounded-lg px-1.5 pt-3 pb-1.5 transition-all"
    style={{
      width: w,
      background: 'linear-gradient(180deg, rgba(36,24,14,0.95), rgba(16,10,6,0.95))',
      border: `2px solid ${glow ? '#fde68a' : ring}`,
      boxShadow: glow ? '0 0 16px rgba(253,230,138,0.55)' : 'none',
      opacity: dim ? 0.5 : 1,
    }}>
    {badge && (
      <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-1.5 rounded text-[11px] font-bold whitespace-nowrap"
        style={{ background: badge.bg || GOLD, color: '#1a1008', fontFamily: CINZEL }}>
        {badge.text}
      </span>
    )}
    <span className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mb-1"
      style={{ background: 'rgba(199,168,105,0.18)', border: `1px solid ${GOLD}`, color: PARCH, fontFamily: CINZEL }}>
      {seat}
    </span>
    <span className="text-[13px] leading-tight mb-1 truncate w-full" style={{ color: PARCH, fontFamily: CINZEL }}>{name}</span>
    <span className="flex flex-wrap justify-center gap-0.5">{chips}</span>
  </div>
);

const Card = ({ kind, small, onClick, selected, faded, label }) => {
  const loyal = kind === 'L';
  const c = loyal ? BLUE : RED;
  const W = small ? 34 : 72;
  const H = small ? 48 : 100;
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      aria-label={label || (loyal ? 'Décret Loyal' : 'Décret de Trahison')}
      className={`rounded-md flex flex-col items-center justify-center shrink-0 transition-all ${onClick ? 'hover:-translate-y-1 cursor-pointer' : ''}`}
      style={{
        width: W, height: H,
        background: loyal ? 'linear-gradient(180deg, #1e3a8a, #0f1d47)' : 'linear-gradient(180deg, #7f1d1d, #3f0d0d)',
        border: `2px solid ${selected ? '#fde68a' : c}`,
        boxShadow: selected ? '0 0 14px rgba(253,230,138,0.6)' : '0 2px 6px rgba(0,0,0,0.5)',
        opacity: faded ? 0.3 : 1,
      }}>
      <span style={{ fontSize: small ? 16 : 32 }}>{loyal ? '🛡️' : '🗡️'}</span>
      {!small && <span className="text-[11px] mt-1 font-bold uppercase" style={{ color: '#fff', fontFamily: CINZEL }}>{loyal ? 'Loyal' : 'Trahison'}</span>}
    </Tag>
  );
};

const Track = ({ label, color, total, filled, icons = {}, last }) => (
  <div>
    <div className="flex items-center justify-between mb-1">
      <span className="text-sm uppercase tracking-widest font-bold" style={{ color, fontFamily: CINZEL }}>{label}</span>
      <span className="text-sm" style={{ color: 'rgba(232,217,168,0.7)' }}>{filled}/{total}</span>
    </div>
    <div className="flex gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className="flex-1 h-11 rounded flex items-center justify-center text-lg"
          style={{
            background: i < filled ? (color === BLUE ? 'rgba(30,58,138,0.85)' : 'rgba(127,29,29,0.85)') : 'rgba(0,0,0,0.45)',
            border: `1px solid ${i < filled ? color : 'rgba(199,168,105,0.25)'}`,
          }}>
          {i < filled ? (color === BLUE ? '🛡️' : '🗡️') : (i === total - 1 ? last : icons[i + 1]) || ''}
        </div>
      ))}
    </div>
  </div>
);

const Bubble = ({ who, color = PARCH, children, right }) => (
  <div className={`flex ${right ? 'justify-end' : ''}`}>
    <div className="max-w-[85%] rounded-lg px-3 py-2 text-base" style={{ background: 'rgba(0,0,0,0.5)', border: `1px solid ${color}66` }}>
      <div className="text-xs uppercase tracking-widest font-bold mb-0.5" style={{ color, fontFamily: CINZEL }}>{who}</div>
      <div style={{ color: PARCH }}>{children}</div>
    </div>
  </div>
);

const KeyPoints = ({ items }) => (
  <div className="rounded-lg p-3 mt-4" style={{ background: 'rgba(199,168,105,0.08)', border: '1px solid rgba(199,168,105,0.35)' }}>
    <div className="text-[13px] uppercase tracking-widest font-bold mb-1.5" style={{ color: GOLD, fontFamily: CINZEL }}>À retenir</div>
    <ul className="space-y-1">
      {items.map((t, i) => (
        <li key={i} className="flex gap-2 text-base leading-snug" style={{ color: PARCH }}>
          <span style={{ color: GOLD }}>✦</span><span>{t}</span>
        </li>
      ))}
    </ul>
  </div>
);

const P = ({ children }) => <p className="text-[17px] leading-relaxed mb-3" style={{ color: 'rgba(232,217,168,0.92)' }}>{children}</p>;
const B = ({ children, c = '#fde68a' }) => <strong style={{ color: c }}>{children}</strong>;

// ---------------------------------------------------------------------
// Interactive pieces
// ---------------------------------------------------------------------
const COMPOSITION = { 5: [3, 1], 6: [4, 1], 7: [4, 2], 8: [5, 2], 9: [5, 3], 10: [6, 3] };

const RolesDemo = () => {
  const [n, setN] = useState(7);
  const [loyal, traitors] = COMPOSITION[n];
  const roles = [
    { icon: '🛡️', name: 'Fidèle', color: BLUE, bg: 'rgba(30,58,138,0.35)', count: loyal,
      knows: 'Ne connaît personne.', goal: 'Protéger la Couronne.' },
    { icon: '⚔️', name: 'Traître', color: RED, bg: 'rgba(127,29,29,0.4)', count: traitors,
      knows: 'Connaît les autres Traîtres et le Tyran.', goal: 'Faire tomber la Couronne.' },
    { icon: '👑', name: 'Tyran', color: PURPLE, bg: 'rgba(88,28,135,0.4)', count: 1,
      knows: n <= 6 ? 'À 5-6 joueurs : connaît son Traître.' : 'À 7+ joueurs : ne connaît personne.', goal: 'Joue avec les Traîtres.' },
  ];
  return (
    <div>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-sm uppercase tracking-widest" style={{ color: GOLD, fontFamily: CINZEL }}>Joueurs à la table :</span>
        {[5, 6, 7, 8, 9, 10].map((k) => (
          <button key={k} type="button" onClick={() => setN(k)} aria-pressed={n === k}
            className="w-10 h-10 rounded-full text-base font-bold transition-colors"
            style={{ background: n === k ? GOLD : 'rgba(0,0,0,0.5)', color: n === k ? '#1a1008' : PARCH, border: `1px solid ${GOLD}`, fontFamily: CINZEL }}>
            {k}
          </button>
        ))}
      </div>
      <div className="grid sm:grid-cols-3 gap-2">
        {roles.map((r) => (
          <div key={r.name} className="rounded-lg p-3" style={{ background: r.bg, border: `1px solid ${r.color}` }}>
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold" style={{ color: r.color, fontFamily: CINZEL }}>{r.icon} {r.name}</span>
              <span className="text-xl font-bold" style={{ color: r.color, fontFamily: CINZEL }}>×{r.count}</span>
            </div>
            <div className="text-sm leading-snug" style={{ color: PARCH }}>{r.goal}</div>
            <div className="text-sm leading-snug mt-1 italic" style={{ color: 'rgba(232,217,168,0.75)' }}>{r.knows}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

const START_HAND = ['T', 'L', 'T'];
const DecreeDemo = () => {
  const [step, setStep] = useState(0); // 0 King discards, 1 Conseiller discards, 2 enacted
  const [kingOut, setKingOut] = useState(null);
  const [consOut, setConsOut] = useState(null);
  const passed = START_HAND.filter((_, i) => i !== kingOut);
  const enacted = consOut === null ? null : passed.filter((_, i) => i !== consOut)[0];
  const reset = () => { setStep(0); setKingOut(null); setConsOut(null); };
  return (
    <Panel>
      <div className="grid sm:grid-cols-3 gap-3 items-start">
        <div className="text-center">
          <div className="text-[13px] uppercase tracking-widest mb-2 font-bold" style={{ color: step === 0 ? '#fde68a' : GOLD, fontFamily: CINZEL }}>① Le Roi pioche 3</div>
          <div className="flex justify-center gap-1.5">
            {START_HAND.map((k, i) => (
              <Card key={i} kind={k} small={step > 0} faded={kingOut === i}
                onClick={step === 0 ? () => { setKingOut(i); setStep(1); } : undefined}
                label={step === 0 ? `Défausser ce décret ${k === 'L' ? 'Loyal' : 'de Trahison'}` : undefined} />
            ))}
          </div>
          {step === 0 && <div className="text-sm mt-2" style={{ color: '#fde68a' }}>👆 Vous êtes le Roi : cliquez sur la carte à <b>écarter</b>.</div>}
        </div>
        <div className="text-center">
          <div className="text-[13px] uppercase tracking-widest mb-2 font-bold" style={{ color: step === 1 ? '#fde68a' : GOLD, fontFamily: CINZEL }}>② Le Conseiller en reçoit 2</div>
          {step >= 1 ? (
            <div className="flex justify-center gap-1.5">
              {passed.map((k, i) => (
                <Card key={i} kind={k} small={step > 1} faded={consOut === i}
                  onClick={step === 1 ? () => { setConsOut(i); setStep(2); } : undefined}
                  label={step === 1 ? `Défausser ce décret ${k === 'L' ? 'Loyal' : 'de Trahison'}` : undefined} />
              ))}
            </div>
          ) : <div className="h-[100px] flex items-center justify-center text-sm italic" style={{ color: 'rgba(232,217,168,0.5)' }}>en attente du Roi…</div>}
          {step === 1 && <div className="text-sm mt-2" style={{ color: '#fde68a' }}>👆 Vous êtes le Conseiller : écartez-en encore 1.</div>}
        </div>
        <div className="text-center">
          <div className="text-[13px] uppercase tracking-widest mb-2 font-bold" style={{ color: step === 2 ? '#fde68a' : GOLD, fontFamily: CINZEL }}>③ Le dernier est adopté</div>
          {enacted ? (
            <div className="flex flex-col items-center gap-2">
              <Card kind={enacted} selected />
              <div className="text-sm" style={{ color: enacted === 'L' ? BLUE : RED }}>
                {enacted === 'L' ? '+1 sur la piste des Fidèles' : '+1 sur la piste des Traîtres'}
              </div>
            </div>
          ) : <div className="h-[100px] flex items-center justify-center text-sm italic" style={{ color: 'rgba(232,217,168,0.5)' }}>…</div>}
        </div>
      </div>
      {step === 2 && (
        <div className="mt-3 text-base text-center" style={{ color: PARCH }}>
          Toute la table voit le décret adopté, <B>mais personne ne voit les cartes écartées</B>.
          {' '}<button type="button" onClick={reset} className="underline underline-offset-4 ml-1" style={{ color: GOLD }}>Recommencer</button>
        </div>
      )}
    </Panel>
  );
};

const VoteDemo = () => {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setRevealed((v) => !v), 2600);
    return () => clearInterval(id);
  }, []);
  const ballots = { 3: 'oui', 4: 'non', 5: 'oui' };
  const seats = [
    { seat: 1, name: 'Vous', badge: { text: '👑 ROI' }, chips: [<Chip key="v" color="#fde68a">Vous</Chip>], ring: GOLD },
    { seat: 2, name: 'Anselme', badge: { text: '📜 PROPOSÉ', bg: '#d6b56a' }, chips: [], ring: '#d6b56a' },
    ...[3, 4, 5].map((s) => ({
      seat: s, name: ['', '', '', 'Perceval', 'Isolde', 'Godfroy'][s],
      chips: [revealed
        ? <Chip key="b" color={ballots[s] === 'oui' ? '#86efac' : '#fca5a5'} bg={ballots[s] === 'oui' ? 'rgba(22,101,52,0.6)' : 'rgba(127,29,29,0.6)'}>{ballots[s]}</Chip>
        : <Chip key="b" color="#86efac">✓ a voté</Chip>],
    })),
  ];
  return (
    <Panel>
      <div className="flex flex-wrap justify-center gap-2">
        {seats.map((s) => <Seat key={s.seat} {...s} w={96} />)}
      </div>
      <div className="text-center text-sm mt-3" style={{ color: 'rgba(232,217,168,0.8)' }}>
        {revealed ? <>Bulletins révélés : <B c="#86efac">2 OUI</B> contre <B c="#fca5a5">1 NON</B> → gouvernement <B>élu</B>.</> : 'Votes secrets en cours… le Roi et le Conseiller proposé ne votent pas.'}
      </div>
    </Panel>
  );
};

const QUIZ = [
  {
    q: 'Vous êtes Fidèle. Que savez-vous au début de la partie ?',
    a: ['Qui sont les Traîtres', 'Uniquement mon propre rôle', 'Qui est le Tyran'],
    ok: 1,
    why: 'Un Fidèle ne connaît que son rôle. Il doit tout déduire des votes, des décrets et des discussions.',
  },
  {
    q: 'Le Roi vous propose comme Conseiller. Pouvez-vous voter ?',
    a: ['Oui, comme tout le monde', 'Non, le gouvernement proposé ne vote pas', 'Seulement en cas d\'égalité'],
    ok: 1,
    why: 'Le Roi et le Conseiller proposé ne votent pas : ce sont les autres joueurs qui décident.',
  },
  {
    q: '3 Trahisons sont adoptées. Le Tyran est élu Conseiller. Que se passe-t-il ?',
    a: ['Rien de spécial', 'Le Tyran est exécuté', 'Les Traîtres gagnent immédiatement'],
    ok: 2,
    why: 'Dès 3 Trahisons, faire élire le Tyran Conseiller fait gagner les Traîtres sur le champ.',
  },
  {
    q: 'Un gouvernement fait passer une Trahison. Les deux juraient être Fidèles. Conclusion ?',
    a: ['L\'un des deux ment forcément', 'Pas forcément : la pioche contient 11 Trahisons sur 17', 'Ils sont tous les deux Traîtres'],
    ok: 1,
    why: 'Avec 11 Trahisons sur 17 cartes, un gouvernement honnête peut recevoir que du rouge. Comparez leurs annonces avant d\'accuser.',
  },
];

const Quiz = ({ answers, setAnswers }) => (
  <div className="space-y-3">
    {QUIZ.map((item, qi) => {
      const picked = answers[qi];
      return (
        <Panel key={qi} className="!p-3">
          <div className="text-base font-bold mb-2" style={{ color: PARCH }}>{qi + 1}. {item.q}</div>
          <div className="grid gap-1.5">
            {item.a.map((label, ai) => {
              const isPicked = picked === ai;
              const showOk = picked !== undefined && ai === item.ok;
              const wrong = isPicked && ai !== item.ok;
              return (
                <button key={ai} type="button" disabled={picked !== undefined}
                  onClick={() => setAnswers((prev) => ({ ...prev, [qi]: ai }))}
                  className="text-left text-base rounded-md px-3 py-2 transition-colors"
                  style={{
                    color: PARCH,
                    background: showOk ? 'rgba(22,101,52,0.55)' : wrong ? 'rgba(127,29,29,0.55)' : 'rgba(0,0,0,0.45)',
                    border: `1px solid ${showOk ? '#86efac' : wrong ? '#fca5a5' : 'rgba(199,168,105,0.3)'}`,
                    cursor: picked === undefined ? 'pointer' : 'default',
                  }}>
                  {showOk ? '✔ ' : wrong ? '✘ ' : ''}{label}
                </button>
              );
            })}
          </div>
          {picked !== undefined && (
            <div className="text-sm mt-2 leading-snug" style={{ color: picked === item.ok ? '#86efac' : '#fca5a5' }}>
              {picked === item.ok ? 'Exact ! ' : 'Pas tout à fait. '}<span style={{ color: PARCH }}>{item.why}</span>
            </div>
          )}
        </Panel>
      );
    })}
  </div>
);

// ---------------------------------------------------------------------
// The 13 screens
// ---------------------------------------------------------------------
const CHAPTERS = ['Les bases', 'Un tour de jeu', 'L\'écran', 'Prêt ?'];

const buildSteps = ({ answers, setAnswers }) => [
  {
    chapter: 0, icon: '🏰', title: 'Bienvenue à la cour',
    body: (
      <>
        <P>Dark Oath est un jeu de <B>déduction et de bluff</B> de 5 à 10 joueurs. Une partie dure 20 à 40 minutes.</P>
        <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center my-4">
          <Panel className="text-center" style={{ borderColor: BLUE }}>
            <div className="text-4xl mb-1">🛡️</div>
            <div className="font-bold" style={{ color: BLUE, fontFamily: CINZEL }}>Les Fidèles</div>
            <div className="text-sm mt-1" style={{ color: PARCH }}>la majorité, qui ne sait rien</div>
          </Panel>
          <div className="text-2xl font-bold" style={{ color: GOLD, fontFamily: CINZEL }}>VS</div>
          <Panel className="text-center" style={{ borderColor: RED }}>
            <div className="text-4xl mb-1">⚔️👑</div>
            <div className="font-bold" style={{ color: RED, fontFamily: CINZEL }}>Les Traîtres</div>
            <div className="text-sm mt-1" style={{ color: PARCH }}>une minorité cachée, avec leur Tyran</div>
          </Panel>
        </div>
        <P>À chaque tour, un <B>Roi</B> choisit un <B>Conseiller</B>. Si la table les accepte, ils adoptent ensemble une loi, appelée <B>décret</B>. Les Fidèles veulent des décrets Loyaux, les Traîtres des décrets de Trahison.</P>
        <KeyPoints items={['Les Traîtres savent qui est qui. Les Fidèles, non.', 'Les Fidèles doivent démasquer les menteurs avant qu\'il ne soit trop tard.']} />
      </>
    ),
  },
  {
    chapter: 0, icon: '🎭', title: 'Votre rôle secret',
    body: (
      <>
        <P>Au début de la partie, chaque joueur reçoit un rôle, <B>gardé secret</B> jusqu'à la fin. Il est rappelé en permanence dans le bandeau « Vous êtes … » en haut de l'écran.</P>
        <RolesDemo />
        <KeyPoints items={['Les Fidèles sont toujours les plus nombreux, mais ils jouent à l\'aveugle.', 'Les Traîtres se connaissent et savent qui est le Tyran : ils jouent en équipe.', 'Le Tyran doit paraître Fidèle pour être nommé Conseiller au bon moment.']} />
      </>
    ),
  },
  {
    chapter: 0, icon: '🏆', title: 'Comment gagner',
    body: (
      <>
        <P>Chaque décret adopté remplit une piste. Le premier camp qui complète la sienne gagne.</P>
        <Panel className="space-y-3">
          <Track label="Piste des Fidèles" color={BLUE} total={5} filled={2} last="🏆" />
          <Track label="Piste des Traîtres" color={RED} total={6} filled={3} last="☠️" icons={{ 3: '👁️', 4: '🪓', 5: '🪓' }} />
        </Panel>
        <div className="grid sm:grid-cols-2 gap-2 mt-3">
          <div className="rounded-lg p-3" style={{ background: 'rgba(30,58,138,0.3)', border: `1px solid ${BLUE}` }}>
            <div className="font-bold text-base mb-1" style={{ color: BLUE, fontFamily: CINZEL }}>🛡️ Les Fidèles gagnent si…</div>
            <div className="text-base" style={{ color: PARCH }}>5 décrets Loyaux sont adoptés,<br /><b>ou</b> le Tyran est exécuté.</div>
          </div>
          <div className="rounded-lg p-3" style={{ background: 'rgba(127,29,29,0.35)', border: `1px solid ${RED}` }}>
            <div className="font-bold text-base mb-1" style={{ color: RED, fontFamily: CINZEL }}>⚔️ Les Traîtres gagnent si…</div>
            <div className="text-base" style={{ color: PARCH }}>6 décrets de Trahison sont adoptés,<br /><b>ou</b> le Tyran est élu Conseiller après 3 Trahisons.</div>
          </div>
        </div>
        <KeyPoints items={['Dès 3 Trahisons, chaque vote devient dangereux : le Tyran pourrait être élu.']} />
      </>
    ),
  },
  {
    chapter: 0, icon: '🃏', title: 'Une pioche piégée',
    body: (
      <>
        <P>La pioche contient <B>17 décrets</B> : seulement <B c={BLUE}>6 Loyaux</B> pour <B c={RED}>11 Trahisons</B>.</P>
        <Panel>
          <div className="flex flex-wrap justify-center gap-1.5">
            {Array.from({ length: 17 }, (_, i) => <Card key={i} kind={i < 6 ? 'L' : 'T'} small />)}
          </div>
        </Panel>
        <P><span className="block mt-3">Conséquence : un gouvernement parfaitement honnête peut <B>tirer que du rouge</B> et être obligé d'adopter une Trahison. Les Traîtres s'en servent comme excuse : « Je n'avais pas le choix ! »</span></P>
        <KeyPoints items={['Une Trahison adoptée ne prouve rien à elle seule.', 'C\'est en comparant les annonces de chacun qu\'on trouve les menteurs.']} />
      </>
    ),
  },
  {
    chapter: 1, icon: '👑', title: 'Étape 1 — Le Roi nomme un Conseiller',
    body: (
      <>
        <P>La couronne passe d'un joueur à l'autre à chaque tour. Le <B>Roi</B> choisit son <B>Conseiller</B> en <B>cliquant sur un joueur</B> autour de la table : les joueurs qu'on peut choisir brillent.</P>
        <Panel>
          <div className="flex flex-wrap justify-center gap-2">
            <Seat seat={1} name="Vous" badge={{ text: '👑 ROI' }} ring={GOLD} chips={[<Chip key="v" color="#fde68a">Vous</Chip>]} w={96} />
            <Seat seat={2} name="Anselme" glow chips={[<Chip key="c" color="#fde68a">Choisir</Chip>]} w={96} />
            <Seat seat={3} name="Perceval" glow chips={[<Chip key="c" color="#fde68a">Choisir</Chip>]} w={96} />
            <Seat seat={4} name="Isolde" dim chips={[<Chip key="x" color="rgba(232,217,168,0.7)">🔒 Exclu</Chip>]} w={96} />
            <Seat seat={5} name="Godfroy" glow chips={[<Chip key="c" color="#fde68a">Choisir</Chip>]} w={96} />
          </div>
        </Panel>
        <KeyPoints items={['🔒 Exclu : le dernier Conseiller élu ne peut pas être nommé tout de suite (le dernier Roi non plus, s\'il reste plus de 5 joueurs).', 'Les autres peuvent conseiller le Roi dans le chat avant qu\'il choisisse.']} />
      </>
    ),
  },
  {
    chapter: 1, icon: '🗳️', title: 'Étape 2 — La table vote',
    body: (
      <>
        <P>Tous les autres joueurs votent <B c="#86efac">OUI</B> ou <B c="#fca5a5">NON</B> en secret. <B>Le Roi et le Conseiller proposé ne votent pas.</B> Les bulletins sont révélés quand tout le monde a voté.</P>
        <VoteDemo />
        <div className="grid sm:grid-cols-2 gap-2 mt-3 text-base" style={{ color: PARCH }}>
          <div className="rounded-lg p-3" style={{ background: 'rgba(22,101,52,0.25)', border: '1px solid #86efac66' }}>
            <b style={{ color: '#86efac' }}>Majorité de OUI</b> → le gouvernement est élu et passe à l'étape des décrets.
          </div>
          <div className="rounded-lg p-3" style={{ background: 'rgba(127,29,29,0.3)', border: '1px solid #fca5a566' }}>
            <b style={{ color: '#fca5a5' }}>Égalité ou NON</b> → la couronne passe au joueur suivant et la <b>Colère du Peuple</b> monte d'un cran.
          </div>
        </div>
        <KeyPoints items={['Au 3ᵉ gouvernement raté d\'affilée, le peuple adopte le décret du dessus de la pioche, au hasard.', 'Les votes sont publics une fois révélés : retenez qui a soutenu qui.']} />
      </>
    ),
  },
  {
    chapter: 1, icon: '📜', title: 'Étape 3 — Le décret, à vous de jouer',
    body: (
      <>
        <P>Le gouvernement élu adopte un décret <B>en secret</B>. Essayez vous-même :</P>
        <DecreeDemo />
        <KeyPoints items={['Le Roi voit 3 cartes, le Conseiller n\'en voit que 2.', 'Seul le décret adopté est révélé. C\'est là que naissent les mensonges.']} />
      </>
    ),
  },
  {
    chapter: 1, icon: '🕯️', title: 'Étape 4 — Le débat',
    body: (
      <>
        <P>Après chaque décret, la table débat jusqu'à <B>60 secondes</B> (chat et micro). Le Roi et le Conseiller <B>annoncent les cartes</B> qu'ils ont vues. Exemple :</P>
        <Panel className="space-y-2">
          <Bubble who="👑 Roi — Godfroy" color={GOLD}>J'ai pioché 2 Trahisons et 1 Loyal. J'ai passé 1 Loyal et 1 Trahison au Conseiller.</Bubble>
          <Bubble who="📜 Conseiller — Isolde" color="#d6b56a" right>Faux ! J'ai reçu 2 Trahisons, je n'avais pas le choix.</Bubble>
          <Bubble who="Perceval" color={PARCH}>Vous ne pouvez pas dire vrai tous les deux… l'un de vous ment.</Bubble>
        </Panel>
        <KeyPoints items={['Si les annonces se contredisent, au moins un des deux est Traître.', 'Les bots lisent le chat : appelez-les par leur nom (« Perceval, t\'as eu quoi ? »).', 'Cliquez sur « Prêt » pour terminer le débat plus tôt.']} />
      </>
    ),
  },
  {
    chapter: 1, icon: '⚜️', title: 'Étape 5 — Les pouvoirs du Roi',
    body: (
      <>
        <P>Certaines cases de la piste des Traîtres donnent un <B>pouvoir</B> au Roi qui vient d'y adopter une Trahison. Il doit l'utiliser immédiatement.</P>
        <div className="grid sm:grid-cols-2 gap-2">
          {[
            ['🔍', 'Enquête', 'Le Roi découvre en secret le camp d\'un joueur.'],
            ['👁️', 'Regard', 'Le Roi voit les 3 prochaines cartes de la pioche.'],
            ['🗳️', 'Élection spéciale', 'Le Roi choisit le prochain Roi.'],
            ['🪓', 'Exécution', 'Le Roi élimine un joueur. Si c\'est le Tyran, les Fidèles gagnent.'],
          ].map(([i, n, d]) => (
            <Panel key={n} className="!p-3 flex gap-3 items-start">
              <span className="text-3xl">{i}</span>
              <span><b className="text-base" style={{ color: '#fde68a', fontFamily: CINZEL }}>{n}</b><span className="block text-base" style={{ color: PARCH }}>{d}</span></span>
            </Panel>
          ))}
        </div>
        <KeyPoints items={['Les icônes sur la piste montrent quel pouvoir arrive (elles dépendent du nombre de joueurs).', 'À partir de 5 Trahisons, le Conseiller peut proposer un veto : si le Roi accepte, les 2 cartes sont jetées.', 'Puis un nouveau tour commence avec le Roi suivant.']} />
      </>
    ),
  },
  {
    chapter: 2, icon: '🖥️', title: 'Lire l\'écran de jeu',
    body: (
      <>
        <P>Pendant la partie, tout ce qu'il faut savoir est affiché :</P>
        <div className="grid sm:grid-cols-[auto_1fr] gap-4 items-center">
          <div className="flex justify-center">
            <Seat seat={3} name="Dame Isolde" badge={{ text: '👑 ROI' }} ring={GOLD} w={128}
              chips={[<Chip key="a" color={RED}>Allié</Chip>, <Chip key="b" color="#94a3b8">Bot</Chip>, <Chip key="c" color="#86efac" bg="rgba(22,101,52,0.6)">Oui</Chip>]} />
          </div>
          <ul className="space-y-1.5 text-base" style={{ color: PARCH }}>
            <li><Chip color="#1a1008" bg={GOLD}>👑 Roi</Chip> / <Chip color="#1a1008" bg="#d6b56a">📜 Proposé</Chip> : le gouvernement du tour.</li>
            <li><Chip color="#fde68a">Vous</Chip> : votre place, toujours en bas de la table.</li>
            <li><Chip color={RED}>Allié</Chip> : visible seulement par les Traîtres et le Tyran.</li>
            <li><Chip color="#86efac">✓ a voté</Chip> puis <Chip color="#86efac" bg="rgba(22,101,52,0.6)">Oui</Chip> / <Chip color="#fca5a5" bg="rgba(127,29,29,0.6)">Non</Chip> : son dernier vote.</li>
            <li><Chip color="rgba(232,217,168,0.7)">🔒 Exclu</Chip> <Chip color="#94a3b8">Bot</Chip> <Chip color="#a3a3a3">Mort</Chip> : ne peut pas être nommé, joueur ordinateur, éliminé.</li>
          </ul>
        </div>
        <Panel className="mt-4 !p-3">
          <div className="flex flex-wrap items-center gap-1.5 text-[13px] uppercase tracking-wider mb-2" style={{ fontFamily: CINZEL, color: 'rgba(232,217,168,0.7)' }}>
            {['👑 Nomination', '🗳️ Vote', '📜 Décret', '🕯️ Débat', '⚜️ Pouvoir'].map((s, i) => (
              <span key={s} className="px-2 py-1 rounded" style={{ background: i === 1 ? 'rgba(199,168,105,0.3)' : 'rgba(0,0,0,0.4)', color: i === 1 ? '#fde68a' : undefined }}>{s}</span>
            ))}
          </div>
          <div className="text-base" style={{ color: '#fde68a' }}>➜ Vous êtes le Conseiller proposé. La table décide : plaidez votre cause dans le chat !</div>
        </Panel>
        <KeyPoints items={['La barre d\'étapes et la phrase ➜ disent toujours ce qui se passe et si c\'est à vous d\'agir.', 'Le panneau d\'action (à droite, ou en bas sur mobile) contient vos boutons.', 'Si vous ne jouez pas à temps, le jeu choisit pour vous : la partie ne bloque jamais.']} />
      </>
    ),
  },
  {
    chapter: 2, icon: '🗡️', title: 'Les bons réflexes',
    body: (
      <div className="grid sm:grid-cols-3 gap-2">
        {[
          { c: BLUE, bg: 'rgba(30,58,138,0.3)', t: '🛡️ Fidèle', tips: ['Notez qui vote pour quels gouvernements.', 'Demandez ses cartes à chaque gouvernement.', 'Dès 3 Trahisons, votez NON au moindre doute sur le Conseiller.'] },
          { c: RED, bg: 'rgba(127,29,29,0.35)', t: '⚔️ Traître', tips: ['Passez parfois du Loyal pour gagner la confiance.', 'Accusez un Fidèle pour semer le doute.', 'Ne votez pas toujours comme vos alliés : ça se voit.'] },
          { c: PURPLE, bg: 'rgba(88,28,135,0.35)', t: '👑 Tyran', tips: ['Jouez le Fidèle modèle, sans excès.', 'Ne mentez pas pour rien : votre réputation est votre arme.', 'Après 3 Trahisons, faites-vous nommer Conseiller.'] },
        ].map((r) => (
          <div key={r.t} className="rounded-lg p-3" style={{ background: r.bg, border: `1px solid ${r.c}` }}>
            <div className="font-bold mb-2" style={{ color: r.c, fontFamily: CINZEL }}>{r.t}</div>
            <ul className="space-y-1.5">
              {r.tips.map((t) => <li key={t} className="text-base leading-snug" style={{ color: PARCH }}>• {t}</li>)}
            </ul>
          </div>
        ))}
      </div>
    ),
  },
  {
    chapter: 3, icon: '❓', title: 'Avez-vous tout compris ?',
    body: (
      <>
        <P>4 questions rapides pour vérifier. Cliquez sur une réponse : l'explication s'affiche aussitôt.</P>
        <Quiz answers={answers} setAnswers={setAnswers} />
      </>
    ),
  },
  {
    chapter: 3, icon: '⚔️', title: 'Vous êtes prêt',
    body: (
      <>
        <P>Le jeu en 5 phrases :</P>
        <ol className="space-y-2">
          {[
            <>Chacun reçoit un rôle secret : <B c={BLUE}>Fidèle</B>, <B c={RED}>Traître</B> ou <B c={PURPLE}>Tyran</B>.</>,
            <>À chaque tour, le <B>Roi</B> nomme un <B>Conseiller</B> et les autres votent.</>,
            <>Le gouvernement élu adopte un décret en secret, puis la table débat.</>,
            <><B c={BLUE}>5 Loyaux</B> ou le Tyran exécuté : victoire des Fidèles.</>,
            <><B c={RED}>6 Trahisons</B> ou le Tyran Conseiller après 3 Trahisons : victoire des Traîtres.</>,
          ].map((t, i) => (
            <li key={i} className="flex gap-3 items-start text-[17px]" style={{ color: PARCH }}>
              <span className="w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-base font-bold" style={{ background: 'rgba(199,168,105,0.2)', border: `1px solid ${GOLD}`, fontFamily: CINZEL }}>{i + 1}</span>
              <span className="pt-0.5">{t}</span>
            </li>
          ))}
        </ol>
        <Panel className="mt-4 text-base" style={{ color: PARCH }}>
          💡 <b>Pour votre première partie</b> : créez une salle, ajoutez 4 bots et lancez. Vous pourrez rouvrir ce tutoriel à tout moment avec le bouton <b>🎓 Tuto</b>.
        </Panel>
      </>
    ),
  },
];

// ---------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------
const Tutorial = ({ open, onClose, onFinish }) => {
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState({});
  const nextRef = useRef(null);
  const bodyRef = useRef(null);
  const steps = buildSteps({ answers, setAnswers });
  const step = steps[i];
  const last = i === steps.length - 1;

  const finish = useCallback(() => {
    try { localStorage.setItem(DONE_KEY, '1'); } catch {}
    (onFinish || onClose)();
  }, [onClose, onFinish]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setI((v) => Math.min(v + 1, steps.length - 1));
      if (e.key === 'ArrowLeft') setI((v) => Math.max(v - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prevOverflow; };
  }, [open, onClose, steps.length]);

  useEffect(() => {
    if (!open) return;
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
    nextRef.current?.focus({ preventScroll: true });
  }, [i, open]);

  useEffect(() => { if (open) { setI(0); setAnswers({}); } }, [open]);

  if (!open) return null;
  const quizDone = Object.keys(answers).length;
  const quizScore = QUIZ.filter((q, k) => answers[k] === q.ok).length;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center sm:p-4" style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(3px)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="tuto-title"
        className="relative w-full h-full sm:h-auto sm:max-h-[92dvh] sm:max-w-4xl flex flex-col sm:rounded-2xl overflow-hidden"
        style={{ background: 'linear-gradient(180deg, #1c130b, #0d0805)', border: '1px solid rgba(199,168,105,0.45)', boxShadow: '0 20px 60px rgba(0,0,0,0.7)' }}>

        {/* Header */}
        <div className="shrink-0 px-4 sm:px-6 pt-4 pb-3" style={{ borderBottom: '1px solid rgba(199,168,105,0.2)' }}>
          <div className="flex items-center justify-between gap-3 mb-3">
            <span className="text-[13px] uppercase tracking-[0.2em]" style={{ color: GOLD, fontFamily: CINZEL }}>
              🎓 Tutoriel · {CHAPTERS[step.chapter]} · {i + 1}/{steps.length}
            </span>
            <button type="button" onClick={onClose} aria-label="Fermer le tutoriel"
              className="w-8 h-8 rounded-full text-xl leading-none hover:bg-amber-900/40" style={{ color: PARCH, border: '1px solid rgba(199,168,105,0.4)' }}>
              ×
            </button>
          </div>
          <div className="flex gap-1" aria-hidden="true">
            {steps.map((s, k) => (
              <button key={k} type="button" tabIndex={-1} onClick={() => setI(k)} title={s.title}
                className="h-1.5 flex-1 rounded-full transition-colors"
                style={{ background: k < i ? GOLD : k === i ? '#fde68a' : 'rgba(199,168,105,0.18)' }} />
            ))}
          </div>
          <h2 id="tuto-title" className="mt-3 text-2xl sm:text-3xl font-bold flex items-center gap-2" style={{ color: '#f5e6b8', fontFamily: CINZEL }}>
            <span aria-hidden="true">{step.icon}</span>{step.title}
          </h2>
        </div>

        {/* Body */}
        <div ref={bodyRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-4" style={{ fontFamily: FELL }}>
          {step.body}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-4 sm:px-6 py-3 flex items-center gap-3" style={{ borderTop: '1px solid rgba(199,168,105,0.2)', background: 'rgba(0,0,0,0.35)' }}>
          <button type="button" onClick={() => setI((v) => Math.max(v - 1, 0))} disabled={i === 0}
            className="px-4 py-2.5 rounded-lg text-base disabled:opacity-30"
            style={{ color: PARCH, border: '1px solid rgba(199,168,105,0.4)', fontFamily: CINZEL }}>
            ← Précédent
          </button>
          <span className="flex-1 text-center text-sm hidden sm:block" style={{ color: 'rgba(232,217,168,0.55)' }}>
            {step.chapter === 3 && i === steps.length - 2
              ? (quizDone ? `${quizScore}/${QUIZ.length} bonnes réponses` : 'Répondez puis continuez')
              : 'Flèches ← → du clavier pour naviguer'}
          </span>
          <span className="flex-1 sm:hidden" />
          <button ref={nextRef} type="button" onClick={() => (last ? finish() : setI((v) => v + 1))}
            className="px-5 py-2.5 rounded-lg text-base font-bold"
            style={{ background: 'linear-gradient(180deg, #d9b56c, #a7823f)', color: '#1a1008', fontFamily: CINZEL, boxShadow: '0 0 12px rgba(199,168,105,0.35)' }}>
            {last ? 'Jouer ⚔️' : i === 0 ? 'Commencer →' : 'Suivant →'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Tutorial;

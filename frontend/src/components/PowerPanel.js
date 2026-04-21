import React, { useState } from 'react';
import { Eye, Skull, Crown, Hourglass, Shield, Sword, Check } from 'lucide-react';
import { Button } from './ui/button';

const titleFont = { fontFamily: "'Cinzel', serif", letterSpacing: '0.08em' };

const PowerPanel = ({ gameState, currentPlayerId, onAction }) => {
  const players = gameState?.players || [];
  const me = players.find((p) => p.id === currentPlayerId);
  const mySeat = me?.seat;
  const regentSeat = gameState?.regent_seat;
  const isKing = mySeat === regentSeat;
  const activePower = gameState?.active_power;
  const result = gameState?.power_result || null;

  const kingName = players.find((p) => p.seat === regentSeat)?.name;
  const [pending, setPending] = useState(false);

  const powerLabel = activePower === 'INVESTIGATE' ? 'Investigation' : activePower === 'EXECUTE' ? 'Exécution' : 'Pouvoir';
  const powerIcon = activePower === 'INVESTIGATE' ? <Eye className="h-5 w-5 text-amber-300" /> : <Skull className="h-5 w-5 text-red-400" />;

  // ---- Non-King : waiting screen ------------------------------------------
  if (!isKing) {
    return (
      <div className="text-center py-6 px-3">
        <Hourglass className="h-10 w-10 text-amber-400/80 mx-auto mb-3 animate-pulse" />
        <p className="text-amber-200 text-base mb-1" style={titleFont}>
          Pouvoir du Roi — {powerLabel}
        </p>
        <p className="text-amber-100/70 text-sm">
          {kingName ? <><strong className="text-amber-300">{kingName}</strong> (siège {regentSeat})</> : `Siège ${regentSeat}`}
          {' '}exerce son pouvoir. Patientez…
        </p>
        {activePower === 'EXECUTE' && (
          <p className="text-red-300/80 text-xs mt-3 italic">
            Quelqu'un va périr.
          </p>
        )}
      </div>
    );
  }

  // ---- King + investigation result : reveal modal -------------------------
  if (activePower === 'INVESTIGATE' && result) {
    const isFidele = result.camp === 'Fidèle';
    const accent = isFidele ? '#3b82f6' : '#dc2626';
    const glow = isFidele ? 'rgba(59, 130, 246, 0.45)' : 'rgba(220, 38, 38, 0.5)';
    const CampIcon = isFidele ? Shield : Sword;

    const ack = async () => {
      if (pending) return;
      setPending(true);
      try { await onAction('ACK_POWER', {}); } finally { setPending(false); }
    };

    return (
      <div className="space-y-4">
        <div
          className="p-4 rounded-lg text-center"
          style={{
            background: `linear-gradient(180deg, ${isFidele ? 'rgba(30, 58, 138, 0.35)' : 'rgba(127, 29, 29, 0.4)'}, rgba(10, 6, 4, 0.9))`,
            border: `2px solid ${accent}`,
            boxShadow: `0 0 18px ${glow}`,
          }}
        >
          <div className="text-xs uppercase tracking-widest mb-2" style={{ color: 'rgba(232, 217, 168, 0.7)', ...titleFont }}>
            Révélation secrète
          </div>
          <CampIcon className="h-12 w-12 mx-auto mb-2" style={{ color: accent, filter: `drop-shadow(0 0 10px ${glow})` }} />
          <div className="text-base text-amber-100/90 mb-1">
            <strong>{result.target_name}</strong> <span className="text-amber-200/60">· siège {result.target_seat}</span>
          </div>
          <div className="text-2xl font-bold" style={{ color: accent, ...titleFont, textShadow: `0 0 10px ${glow}` }}>
            {result.camp.toUpperCase()}
          </div>
          <div className="text-xs italic mt-3" style={{ color: 'rgba(232, 217, 168, 0.65)', fontFamily: "'IM Fell English', serif" }}>
            {isFidele
              ? 'Ce joueur sert la Couronne.'
              : 'Ce joueur conspire dans l\'ombre… ou EST le Tyran lui-même.'}
          </div>
        </div>

        <Button
          onClick={ack}
          disabled={pending}
          className="w-full"
          style={{
            background: 'rgba(120, 53, 15, 0.6)',
            border: '1px solid #c7a869',
            color: '#e8d9a8',
            ...titleFont,
            textTransform: 'uppercase',
            fontSize: '0.9rem',
          }}
        >
          <Check className="h-4 w-4 mr-2" /> Continuer
        </Button>
      </div>
    );
  }

  // ---- King choosing target -----------------------------------------------
  const candidates = players.filter((p) => p.alive && p.seat !== mySeat);

  const act = async (targetSeat) => {
    if (pending) return;
    if (activePower === 'EXECUTE') {
      if (!window.confirm(`Exécuter le siège ${targetSeat} ? Cette action est irréversible.`)) return;
    }
    setPending(true);
    try {
      await onAction(activePower, { targetSeat });
    } finally {
      setPending(false);
    }
  };

  const isExec = activePower === 'EXECUTE';
  const headerBg = isExec ? 'rgba(127, 29, 29, 0.35)' : 'rgba(120, 53, 15, 0.3)';
  const headerBorder = isExec ? 'rgba(220, 38, 38, 0.55)' : 'rgba(199, 168, 105, 0.45)';
  const headerText = isExec
    ? 'Choisissez un joueur à exécuter. Si c\'est le Tyran, les Fidèles triomphent.'
    : 'Choisissez un joueur à investiguer. Vous apprendrez s\'il est Fidèle ou Traître.';

  return (
    <div className="space-y-4">
      <div
        className="p-3 rounded-lg flex items-start gap-3"
        style={{
          background: headerBg,
          border: `1px solid ${headerBorder}`,
        }}
      >
        {isExec ? <Skull className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" /> : <Eye className="h-5 w-5 text-amber-300 flex-shrink-0 mt-0.5" />}
        <div>
          <p className="text-amber-200 font-medium text-sm mb-1 flex items-center gap-2" style={titleFont}>
            <Crown className="h-4 w-4 text-amber-400" />
            Pouvoir du Roi — {powerLabel}
          </p>
          <p className="text-amber-100/80 text-xs leading-relaxed">
            {headerText}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {candidates.map((p) => (
          <Button
            key={p.seat}
            onClick={() => act(p.seat)}
            disabled={pending}
            className="w-full justify-start h-auto p-3 transition-all"
            style={{
              background: 'rgba(20, 14, 8, 0.6)',
              border: `1px solid ${isExec ? 'rgba(220, 38, 38, 0.4)' : 'rgba(199, 168, 105, 0.35)'}`,
              color: '#e8d9a8',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = isExec ? 'rgba(127, 29, 29, 0.45)' : 'rgba(120, 53, 15, 0.45)';
              e.currentTarget.style.borderColor = isExec ? '#dc2626' : '#c7a869';
              e.currentTarget.style.boxShadow = `0 0 10px ${isExec ? 'rgba(220, 38, 38, 0.35)' : 'rgba(199, 168, 105, 0.35)'}`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(20, 14, 8, 0.6)';
              e.currentTarget.style.borderColor = isExec ? 'rgba(220, 38, 38, 0.4)' : 'rgba(199, 168, 105, 0.35)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div className="flex items-center gap-3 w-full">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                style={{
                  background: 'rgba(199, 168, 105, 0.2)',
                  border: '1px solid rgba(199, 168, 105, 0.5)',
                  color: '#e8d9a8',
                  ...titleFont,
                }}
              >
                {p.seat}
              </div>
              <span className="font-medium text-base truncate" style={titleFont}>
                {p.name}
              </span>
              <span className="ml-auto flex-shrink-0">
                {powerIcon}
              </span>
            </div>
          </Button>
        ))}
      </div>
    </div>
  );
};

export default PowerPanel;

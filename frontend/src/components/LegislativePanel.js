import React from 'react';
import { Gavel, FileText, Eye, Clock, Crown, ScrollText, Shield, Sword } from 'lucide-react';
import { Button } from './ui/button';

const titleFont = { fontFamily: "'Cinzel', serif", letterSpacing: '0.05em' };

const LegislativePanel = ({ phase, mySeat, regentSeat, chambellanSeat, players, cards, onDiscard }) => {
  const isRegent = mySeat === regentSeat;
  const isConseiller = mySeat === chambellanSeat;
  const isActivePlayer = (phase === 'LEGIS_REGENT' && isRegent) || (phase === 'LEGIS_CHAMBELLAN' && isConseiller);

  const regent = players.find(p => p.seat === regentSeat);
  const chambellan = players.find(p => p.seat === chambellanSeat);

  const phaseTitle = phase === 'LEGIS_REGENT'
    ? 'Session Législative — Roi'
    : phase === 'LEGIS_CHAMBELLAN'
      ? 'Session Législative — Conseiller'
      : 'Session Législative';

  const phaseDescription = phase === 'LEGIS_REGENT'
    ? (isRegent
        ? 'Vous devez défausser une carte et passer les 2 restantes au Conseiller.'
        : `Le Roi (${regent?.name || '…'}) examine 3 cartes et en défausse une.`)
    : phase === 'LEGIS_CHAMBELLAN'
      ? (isConseiller
          ? "Choisissez une carte à adopter et défaussez l'autre."
          : `Le Conseiller (${chambellan?.name || '…'}) choisit la carte à adopter.`)
      : 'Session législative en cours.';

  // --- Spectator view ---
  if (!isActivePlayer) {
    return (
      <div className="space-y-4">
        <div
          className="p-3 rounded-lg flex items-start gap-3"
          style={{
            background: 'rgba(199, 168, 105, 0.1)',
            border: '1px solid rgba(199, 168, 105, 0.3)',
          }}
        >
          <Gavel className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-200 font-medium text-sm mb-1" style={titleFont}>
              {phaseTitle}
            </p>
            <p className="text-amber-100/80 text-xs leading-relaxed">
              {phaseDescription}
            </p>
          </div>
        </div>

        <div
          className="text-center p-6 rounded-lg"
          style={{
            background: 'rgba(20, 14, 8, 0.6)',
            border: '1px solid rgba(199, 168, 105, 0.3)',
          }}
        >
          <Clock className="h-10 w-10 text-amber-400/80 mx-auto mb-3 animate-pulse" />
          <p className="text-amber-200 text-base mb-1" style={titleFont}>
            En attente de la décision
          </p>
          <p className="text-amber-100/70 text-sm italic">
            {phaseDescription}
          </p>
        </div>
      </div>
    );
  }

  // --- Active player view ---
  const isLoyalCard = (c) => c === 'LOYAL';

  return (
    <div className="space-y-4">
      {/* Header / role */}
      <div
        className="p-3 rounded-lg flex items-start gap-3"
        style={{
          background: 'rgba(120, 53, 15, 0.3)',
          border: '1px solid rgba(199, 168, 105, 0.45)',
        }}
      >
        {phase === 'LEGIS_REGENT' ? (
          <Crown className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
        ) : (
          <ScrollText className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
        )}
        <div>
          <p className="text-amber-200 font-medium text-sm mb-1" style={titleFont}>
            {phase === 'LEGIS_REGENT' ? 'Vous êtes le Roi' : 'Vous êtes le Conseiller'}
          </p>
          <p className="text-amber-100/80 text-xs leading-relaxed">
            {phaseDescription}
          </p>
        </div>
      </div>

      {/* Cards */}
      <div className="space-y-2">
        <h4
          className="flex items-center gap-2 text-xs uppercase tracking-widest"
          style={{ color: 'rgba(232, 217, 168, 0.75)', ...titleFont }}
        >
          <FileText className="h-3.5 w-3.5" />
          {phase === 'LEGIS_REGENT' ? 'Cartes tirées — défaussez-en 1' : 'Cartes reçues — adoptez-en 1'}
        </h4>

        {cards && cards.length > 0 ? (
          <div className="space-y-2">
            {cards.map((card, index) => {
              const loyal = isLoyalCard(card);
              const accent = loyal ? '#3b82f6' : '#dc2626';
              const glow = loyal ? 'rgba(59, 130, 246, 0.35)' : 'rgba(220, 38, 38, 0.4)';
              const CampIcon = loyal ? Shield : Sword;
              return (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 rounded-lg"
                  style={{
                    background: loyal
                      ? 'rgba(30, 58, 138, 0.22)'
                      : 'rgba(127, 29, 29, 0.28)',
                    border: `1px solid ${accent}`,
                    boxShadow: `0 0 10px ${glow}`,
                  }}
                >
                  <CampIcon
                    className="h-6 w-6 flex-shrink-0"
                    style={{ color: accent, filter: `drop-shadow(0 0 6px ${glow})` }}
                  />
                  <div className="flex-1 min-w-0">
                    <div
                      className="font-semibold text-sm truncate"
                      style={{ color: loyal ? '#bfdbfe' : '#fecaca', ...titleFont }}
                    >
                      {loyal ? 'Décret Loyal' : 'Décret de Trahison'}
                    </div>
                  </div>
                  <Button
                    onClick={() => onDiscard(index)}
                    className="transition-all flex-shrink-0"
                    style={{
                      background: 'rgba(20, 14, 8, 0.7)',
                      border: '1px solid rgba(199, 168, 105, 0.5)',
                      color: '#e8d9a8',
                      ...titleFont,
                      textTransform: 'uppercase',
                      fontSize: '0.75rem',
                      letterSpacing: '0.1em',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(120, 53, 15, 0.55)';
                      e.currentTarget.style.borderColor = '#c7a869';
                      e.currentTarget.style.boxShadow = '0 0 10px rgba(199, 168, 105, 0.4)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(20, 14, 8, 0.7)';
                      e.currentTarget.style.borderColor = 'rgba(199, 168, 105, 0.5)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    {phase === 'LEGIS_REGENT' ? 'Défausser' : 'Adopter'}
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <div
            className="text-center p-5 rounded-lg"
            style={{
              background: 'rgba(20, 14, 8, 0.6)',
              border: '1px dashed rgba(199, 168, 105, 0.3)',
            }}
          >
            <Eye className="h-8 w-8 text-amber-400/60 mx-auto mb-2" />
            <p className="text-amber-100/80 text-sm" style={titleFont}>
              En attente des cartes…
            </p>
            <p className="text-amber-100/50 text-xs mt-1 italic">
              Les cartes seront distribuées automatiquement
            </p>
          </div>
        )}
      </div>

      {/* Current government */}
      <div
        className="p-3 rounded-lg"
        style={{
          background: 'rgba(20, 14, 8, 0.6)',
          border: '1px solid rgba(199, 168, 105, 0.3)',
        }}
      >
        <div
          className="text-[10px] uppercase tracking-widest mb-2"
          style={{ color: 'rgba(232, 217, 168, 0.7)', ...titleFont }}
        >
          Gouvernement actuel
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div
            className="p-2 rounded text-center"
            style={{
              background: 'rgba(120, 53, 15, 0.3)',
              border: '1px solid rgba(199, 168, 105, 0.35)',
            }}
          >
            <Crown className="h-4 w-4 mx-auto mb-1 text-amber-400" />
            <div className="text-[10px] uppercase tracking-widest" style={{ color: 'rgba(232, 217, 168, 0.7)', ...titleFont }}>
              Roi
            </div>
            <div className="text-sm font-medium text-amber-100 truncate" style={titleFont}>
              {regent?.name || '—'}
            </div>
            <div className="text-[10px] text-amber-100/60">Siège {regentSeat}</div>
          </div>
          <div
            className="p-2 rounded text-center"
            style={{
              background: 'rgba(120, 53, 15, 0.3)',
              border: '1px solid rgba(199, 168, 105, 0.35)',
            }}
          >
            <ScrollText className="h-4 w-4 mx-auto mb-1 text-amber-400" />
            <div className="text-[10px] uppercase tracking-widest" style={{ color: 'rgba(232, 217, 168, 0.7)', ...titleFont }}>
              Conseiller
            </div>
            <div className="text-sm font-medium text-amber-100 truncate" style={titleFont}>
              {chambellan?.name || '—'}
            </div>
            <div className="text-[10px] text-amber-100/60">Siège {chambellanSeat}</div>
          </div>
        </div>
      </div>

      {/* Rule */}
      <div
        className="p-2 rounded-lg"
        style={{
          background: 'rgba(40, 28, 18, 0.5)',
          border: '1px solid rgba(199, 168, 105, 0.2)',
        }}
      >
        <p className="text-[11px] text-amber-100/70 leading-snug italic">
          <strong className="text-amber-300/90 not-italic">Règle :</strong>{' '}
          {phase === 'LEGIS_REGENT'
            ? 'Le Roi tire 3 cartes, en défausse 1 secrètement, et passe les 2 restantes au Conseiller.'
            : "Le Conseiller reçoit 2 cartes du Roi, en adopte 1, et défausse l'autre secrètement."}
        </p>
      </div>
    </div>
  );
};

export default LegislativePanel;

import React from 'react';
import { Crown, Users, Hourglass } from 'lucide-react';
import { Button } from './ui/button';

const NominationPanel = ({ meSeat, regentSeat, players, prevGovernment, disgracedPlayerSeat, onNominate }) => {
  const isRegent = meSeat === regentSeat;
  const regentName = players.find(p => p.seat === regentSeat)?.name;

  if (!isRegent) {
    return (
      <div className="text-center py-6 px-3">
        <Hourglass className="h-10 w-10 text-amber-400/80 mx-auto mb-3 animate-pulse" />
        <p className="text-amber-200 text-base mb-1" style={{ fontFamily: "'Cinzel', serif", letterSpacing: '0.05em' }}>
          Le Roi délibère…
        </p>
        <p className="text-amber-100/70 text-sm">
          {regentName ? <><strong className="text-amber-300">{regentName}</strong> (siège {regentSeat})</> : `Siège ${regentSeat}`} doit désigner son Conseiller.
        </p>
      </div>
    );
  }

  const validCandidates = players.filter(player => {
    if (player.seat === regentSeat) return false;
    if (!player.alive) return false;
    if (prevGovernment) {
      if (player.seat === prevGovernment.regent || player.seat === prevGovernment.chambellan) {
        return false;
      }
    }
    if (disgracedPlayerSeat && player.seat === disgracedPlayerSeat) {
      return false;
    }
    return true;
  });

  const excludedSeats = [];
  if (prevGovernment?.regent) excludedSeats.push({ seat: prevGovernment.regent, reason: 'ancien Roi' });
  if (prevGovernment?.chambellan) excludedSeats.push({ seat: prevGovernment.chambellan, reason: 'ancien Conseiller' });
  if (disgracedPlayerSeat) excludedSeats.push({ seat: disgracedPlayerSeat, reason: 'désavoué' });

  return (
    <div className="space-y-4">
      <div
        className="p-3 rounded-lg flex items-start gap-3"
        style={{
          background: 'rgba(199, 168, 105, 0.1)',
          border: '1px solid rgba(199, 168, 105, 0.3)',
        }}
      >
        <Crown className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-amber-200 font-medium text-sm mb-1" style={{ fontFamily: "'Cinzel', serif", letterSpacing: '0.05em' }}>
            Vous êtes le Roi
          </p>
          <p className="text-amber-100/80 text-xs leading-relaxed">
            Désignez un <strong className="text-amber-300">Conseiller</strong> pour former votre gouvernement.
          </p>
        </div>
      </div>

      {validCandidates.length > 0 ? (
        <div className="space-y-2">
          {validCandidates.map(player => (
            <Button
              key={player.seat}
              onClick={() => onNominate(player.seat)}
              className="w-full justify-start h-auto p-3 transition-all"
              style={{
                background: 'rgba(20, 14, 8, 0.6)',
                border: '1px solid rgba(199, 168, 105, 0.35)',
                color: '#e8d9a8',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(120, 53, 15, 0.45)';
                e.currentTarget.style.borderColor = '#c7a869';
                e.currentTarget.style.boxShadow = '0 0 10px rgba(199, 168, 105, 0.35)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(20, 14, 8, 0.6)';
                e.currentTarget.style.borderColor = 'rgba(199, 168, 105, 0.35)';
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
                    fontFamily: "'Cinzel', serif",
                  }}
                >
                  {player.seat}
                </div>
                <span className="font-medium text-base truncate" style={{ fontFamily: "'Cinzel', serif" }}>
                  {player.name}
                </span>
              </div>
            </Button>
          ))}
        </div>
      ) : (
        <div
          className="text-center p-4 rounded-lg"
          style={{
            background: 'rgba(127, 29, 29, 0.25)',
            border: '1px solid rgba(220, 38, 38, 0.45)',
          }}
        >
          <p className="text-red-200 font-medium text-sm mb-1" style={{ fontFamily: "'Cinzel', serif", letterSpacing: '0.05em' }}>
            Aucun candidat éligible
          </p>
          <p className="text-red-300/80 text-xs">
            Tous les autres joueurs sont exclus (ancien gouvernement, désavoué ou éliminés).
          </p>
        </div>
      )}

      {excludedSeats.length > 0 && (
        <div className="flex flex-wrap gap-2 text-xs text-amber-100/60">
          <Users className="h-3.5 w-3.5 mt-0.5" />
          <span className="uppercase tracking-widest" style={{ fontFamily: "'Cinzel', serif", fontSize: '10px' }}>Exclus&nbsp;:</span>
          {excludedSeats.map(({ seat, reason }) => (
            <span
              key={`${seat}-${reason}`}
              className="px-2 py-0.5 rounded"
              style={{
                background: 'rgba(40, 28, 18, 0.6)',
                border: '1px solid rgba(199, 168, 105, 0.2)',
              }}
            >
              Siège {seat} · {reason}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default NominationPanel;

import React from 'react';
import { Vote, ThumbsUp, ThumbsDown, Clock, Users, Crown, ScrollText, Hourglass } from 'lucide-react';
import { Button } from './ui/button';

const titleFont = { fontFamily: "'Cinzel', serif", letterSpacing: '0.05em' };

const VotePanel = ({ players, regentSeat, nomineeSeat, votesCast = [], myVote, mySeat, onVote, pending = false }) => {
  const regent = players.find(p => p.seat === regentSeat);
  const nominee = players.find(p => p.seat === nomineeSeat);

  // Livret : tous les joueurs vivants votent (Roi et Conseiller compris)
  const me = players.find(p => p.seat === mySeat);
  const canIVote = !!me && me.alive !== false;

  const alivePlayers = players.filter(p => p.alive);
  const totalVotes = votesCast.length;
  const votesNeeded = alivePlayers.length;
  const progressPct = votesNeeded > 0 ? (totalVotes / votesNeeded) * 100 : 0;
  const waitingFor = alivePlayers.filter(p => !votesCast.includes(p.id));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div
        className="p-3 rounded-lg flex items-start gap-3"
        style={{
          background: 'rgba(199, 168, 105, 0.1)',
          border: '1px solid rgba(199, 168, 105, 0.3)',
        }}
      >
        <Vote className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-amber-200 font-medium text-sm mb-1" style={titleFont}>
            Vote du Gouvernement
          </p>
          <p className="text-amber-100/80 text-xs leading-relaxed">
            Approuvez ou rejetez ce gouvernement. La majorité simple est requise — en cas d'égalité, il est rejeté.
          </p>
        </div>
      </div>

      {/* Voting Buttons */}
      {!canIVote ? (
        <div
          className="text-center p-4 rounded-lg"
          style={{
            background: 'rgba(120, 53, 15, 0.25)',
            border: '1px solid rgba(199, 168, 105, 0.3)',
          }}
        >
          <Hourglass className="h-8 w-8 mx-auto mb-2 text-amber-400/80 animate-pulse" />
          <p className="text-amber-200 font-medium text-sm mb-1" style={titleFont}>
            Vous ne votez pas
          </p>
          <p className="text-amber-100/70 text-xs">
            Les morts observent en silence. Vous êtes spectateur.
          </p>
        </div>
      ) : !myVote ? (
        <div className="space-y-3">
          <p className="text-center text-sm text-amber-100/80" style={titleFont}>
            Votez pour ou contre ce gouvernement :
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={() => onVote('oui')}
              disabled={pending}
              className="h-12 transition-all"
              style={{
                background: 'rgba(22, 101, 52, 0.6)',
                border: '1px solid rgba(134, 239, 172, 0.5)',
                color: '#d1fae5',
                ...titleFont,
                textTransform: 'uppercase',
                fontSize: '0.95rem',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(22, 101, 52, 0.85)';
                e.currentTarget.style.borderColor = '#86efac';
                e.currentTarget.style.boxShadow = '0 0 12px rgba(134, 239, 172, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(22, 101, 52, 0.6)';
                e.currentTarget.style.borderColor = 'rgba(134, 239, 172, 0.5)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <ThumbsUp className="h-5 w-5 mr-2" />
              OUI
            </Button>
            <Button
              onClick={() => onVote('non')}
              disabled={pending}
              className="h-12 transition-all"
              style={{
                background: 'rgba(127, 29, 29, 0.6)',
                border: '1px solid rgba(252, 165, 165, 0.5)',
                color: '#fee2e2',
                ...titleFont,
                textTransform: 'uppercase',
                fontSize: '0.95rem',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(127, 29, 29, 0.85)';
                e.currentTarget.style.borderColor = '#fca5a5';
                e.currentTarget.style.boxShadow = '0 0 12px rgba(252, 165, 165, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(127, 29, 29, 0.6)';
                e.currentTarget.style.borderColor = 'rgba(252, 165, 165, 0.5)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <ThumbsDown className="h-5 w-5 mr-2" />
              NON
            </Button>
          </div>
        </div>
      ) : (
        <div
          className="text-center p-4 rounded-lg"
          style={{
            background: 'rgba(20, 14, 8, 0.6)',
            border: `1px solid ${myVote === 'oui' ? 'rgba(134, 239, 172, 0.5)' : 'rgba(252, 165, 165, 0.5)'}`,
          }}
        >
          <p className="font-medium text-sm mb-2" style={{ color: myVote === 'oui' ? '#86efac' : '#fca5a5', ...titleFont }}>
            Votre vote : {myVote === 'oui' ? 'OUI' : 'NON'}
          </p>
          <p className="text-xs text-amber-100/70">
            En attente des autres joueurs…
          </p>
        </div>
      )}

      {/* Government Info */}
      <div
        className="p-4 rounded-lg"
        style={{
          background: 'rgba(20, 14, 8, 0.6)',
          border: '1px solid rgba(199, 168, 105, 0.35)',
        }}
      >
        <div className="text-xs uppercase tracking-widest mb-3" style={{ color: 'rgba(232, 217, 168, 0.7)', ...titleFont }}>
          Gouvernement proposé
        </div>
        <div className="grid grid-cols-2 gap-3">
          {/* Roi */}
          <div
            className="p-3 rounded text-center"
            style={{
              background: 'rgba(120, 53, 15, 0.3)',
              border: '1px solid rgba(199, 168, 105, 0.4)',
            }}
          >
            <Crown className="h-5 w-5 mx-auto mb-1 text-amber-400" />
            <div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'rgba(232, 217, 168, 0.7)', ...titleFont }}>
              Roi
            </div>
            <div className="font-medium text-amber-100 truncate" style={titleFont}>
              {regent?.name}
            </div>
            <div className="text-[11px] text-amber-100/60">Siège {regentSeat}</div>
          </div>
          {/* Conseiller */}
          <div
            className="p-3 rounded text-center"
            style={{
              background: 'rgba(120, 53, 15, 0.3)',
              border: '1px solid rgba(199, 168, 105, 0.4)',
            }}
          >
            <ScrollText className="h-5 w-5 mx-auto mb-1 text-amber-400" />
            <div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'rgba(232, 217, 168, 0.7)', ...titleFont }}>
              Conseiller
            </div>
            <div className="font-medium text-amber-100 truncate" style={titleFont}>
              {nominee?.name}
            </div>
            <div className="text-[11px] text-amber-100/60">Siège {nomineeSeat}</div>
          </div>
        </div>
      </div>

      {/* Vote Progress */}
      <div
        className="p-3 rounded-lg space-y-2"
        style={{
          background: 'rgba(20, 14, 8, 0.5)',
          border: '1px solid rgba(199, 168, 105, 0.25)',
        }}
      >
        <div className="flex justify-between items-center">
          <span className="text-xs uppercase tracking-widest" style={{ color: 'rgba(232, 217, 168, 0.7)', ...titleFont }}>
            Progression
          </span>
          <span className="text-xs text-amber-100/80" style={titleFont}>
            {totalVotes}/{votesNeeded}
          </span>
        </div>
        {/* Custom progress bar */}
        <div
          className="h-2 rounded-full overflow-hidden"
          style={{ background: 'rgba(40, 28, 18, 0.8)', border: '1px solid rgba(199, 168, 105, 0.2)' }}
        >
          <div
            className="h-full transition-all duration-300"
            style={{
              width: `${progressPct}%`,
              background: 'linear-gradient(90deg, #c7a869, #e8d9a8)',
              boxShadow: '0 0 8px rgba(199, 168, 105, 0.5)',
            }}
          />
        </div>
        <div className="text-xs pt-1 text-amber-100/70 italic">
          Bulletins secrets — révélés quand tout le monde a voté.
          {waitingFor.length > 0 && waitingFor.length <= 4 && (
            <span className="block not-italic mt-1">En attente de : {waitingFor.map(p => p.name).join(', ')}</span>
          )}
        </div>
      </div>

      {/* Vote Status */}
      <div
        className="p-3 rounded-lg"
        style={{
          background: 'rgba(40, 28, 18, 0.5)',
          border: '1px solid rgba(199, 168, 105, 0.2)',
        }}
      >
        <div className="flex items-center justify-between text-xs text-amber-100/70">
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5" />
            <span>
              {totalVotes < votesNeeded ? 'Vote en cours…' : 'Décompte…'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-3.5 w-3.5" />
            <span>
              {votesNeeded - totalVotes} restant{votesNeeded - totalVotes > 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VotePanel;

import React, { useEffect, useState } from 'react';
import { AlertTriangle, Clock, Check, X } from 'lucide-react';
import { Button } from './ui/button';

const DefiancePanel = ({
  gameState,
  currentPlayerId,
  onVote, // (targetSeat | null) => Promise
}) => {
  const players = gameState?.players || [];
  const me = players.find((p) => p.id === currentPlayerId);
  const mySeat = me?.seat;
  const counts = gameState?.defiance_counts || {};
  const threshold = gameState?.defiance_threshold || 3;
  const duration = gameState?.defiance_duration || 25;
  const startTime = gameState?.defiance_start_time;
  const alreadyVoted = !!gameState?.defiance_has_voted;
  const myTarget = gameState?.defiance_my_target ?? null;

  const [timeLeft, setTimeLeft] = useState(duration);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!startTime) return;
    const tick = () => {
      const elapsed = Date.now() / 1000 - startTime;
      setTimeLeft(Math.max(0, Math.ceil(duration - elapsed)));
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [startTime, duration]);

  const submit = async (targetSeat) => {
    if (pending || alreadyVoted) return;
    setPending(true);
    try {
      await onVote(targetSeat);
    } finally {
      setPending(false);
    }
  };

  const candidates = players.filter(
    (p) => p.alive && p.seat !== mySeat
  );

  const urgent = timeLeft <= 8;

  return (
    <div className="space-y-4">
      {/* Header message + timer */}
      <div
        className="p-3 rounded-lg flex items-center gap-3"
        style={{
          background: 'rgba(127, 29, 29, 0.25)',
          border: `1px solid ${urgent ? '#dc2626' : 'rgba(199, 168, 105, 0.4)'}`,
          boxShadow: urgent ? '0 0 14px rgba(220, 38, 38, 0.4)' : 'none',
        }}
      >
        <AlertTriangle className={`h-6 w-6 flex-shrink-0 ${urgent ? 'text-red-400' : 'text-amber-400'}`} />
        <div className="flex-1">
          <p
            className="text-sm font-semibold"
            style={{ color: '#e8d9a8', fontFamily: "'Cinzel', serif", letterSpacing: '0.05em' }}
          >
            Désignez un suspect
          </p>
          <p className="text-xs text-amber-100/70 italic">Le peuple observe…</p>
        </div>
        <div
          className="flex items-center gap-1 px-2 py-1 rounded-full text-sm"
          style={{
            background: urgent ? 'rgba(127, 29, 29, 0.7)' : 'rgba(120, 53, 15, 0.6)',
            border: `1px solid ${urgent ? '#dc2626' : '#c7a869'}`,
            color: urgent ? '#fecaca' : '#e8d9a8',
            animation: urgent ? 'pulse 1s infinite' : 'none',
          }}
        >
          <Clock className="h-4 w-4" />
          <span className="font-bold tabular-nums">{timeLeft}s</span>
        </div>
      </div>

      {/* Already voted state */}
      {alreadyVoted && (
        <div
          className="p-3 rounded-lg text-center text-sm"
          style={{
            background: 'rgba(20, 14, 8, 0.6)',
            border: '1px solid rgba(199, 168, 105, 0.3)',
            color: '#e8d9a8',
            fontFamily: "'IM Fell English', serif",
          }}
        >
          <Check className="inline h-4 w-4 mr-1 text-emerald-400" />
          {myTarget
            ? <>Vous avez désigné le <strong>Siège {myTarget}</strong>.</>
            : <>Vous avez choisi de <strong>passer</strong>.</>}
          <p className="text-xs text-amber-100/60 italic mt-1">En attente des autres joueurs…</p>
        </div>
      )}

      {/* Candidate buttons */}
      {!alreadyVoted && (
        <>
          <div className="space-y-2">
            {candidates.map((p) => {
              const c = counts[p.seat] || 0;
              const barPct = Math.min(100, (c / threshold) * 100);
              return (
                <Button
                  key={p.seat}
                  onClick={() => submit(p.seat)}
                  disabled={pending}
                  className="w-full justify-start h-auto p-3 transition-all"
                  style={{
                    background: 'rgba(20, 14, 8, 0.6)',
                    border: '1px solid rgba(199, 168, 105, 0.35)',
                    color: '#e8d9a8',
                  }}
                >
                  <div className="flex items-center gap-3 w-full">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                      style={{
                        background: 'rgba(199, 168, 105, 0.2)',
                        border: '1px solid rgba(199, 168, 105, 0.5)',
                        fontFamily: "'Cinzel', serif",
                      }}
                    >
                      {p.seat}
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <div className="font-medium text-base truncate" style={{ fontFamily: "'Cinzel', serif" }}>
                        {p.name}
                      </div>
                      <div
                        className="mt-1 h-1.5 rounded overflow-hidden"
                        style={{ background: 'rgba(40, 28, 18, 0.8)' }}
                      >
                        <div
                          className="h-full transition-all"
                          style={{
                            width: `${barPct}%`,
                            background: c >= threshold - 1 ? '#dc2626' : '#c7a869',
                          }}
                        />
                      </div>
                    </div>
                    <span
                      className="text-xs font-bold tabular-nums ml-2"
                      style={{ color: c >= threshold - 1 ? '#fecaca' : '#e8d9a8' }}
                    >
                      {c}/{threshold}
                    </span>
                  </div>
                </Button>
              );
            })}
          </div>

          <Button
            onClick={() => submit(null)}
            disabled={pending}
            className="w-full"
            style={{
              background: 'rgba(40, 28, 18, 0.7)',
              border: '1px dashed rgba(199, 168, 105, 0.4)',
              color: '#c7a869',
              fontFamily: "'Cinzel', serif",
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              fontSize: '0.85rem',
            }}
          >
            <X className="h-4 w-4 mr-2" /> Passer
          </Button>
        </>
      )}
    </div>
  );
};

export default DefiancePanel;

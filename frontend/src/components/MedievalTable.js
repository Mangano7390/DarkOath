import React from "react";

const MedievalTable = ({
  players,
  size = 500,
  disgracedPlayerSeat = null,
  speakingPlayers = [],
  regentSeat = null,
  nomineeSeat = null,
  votedPlayerIds = [],
  phase = null,
}) => {
  const count = Math.max(players?.length || 0, 1);
  const radius = size / 2 - 55;
  const tableRadius = size / 3;
  const cx = size / 2;
  const cy = size / 2;
  const votedSet = new Set(votedPlayerIds);
  const showVoteSeals = phase === 'VOTE';

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="mx-auto">
      <defs>
        <radialGradient id="tableWood" cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor="#6b4a28" />
          <stop offset="55%" stopColor="#4a311a" />
          <stop offset="100%" stopColor="#2a1a0d" />
        </radialGradient>
        <radialGradient id="brazierGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffb347" stopOpacity="0.9" />
          <stop offset="40%" stopColor="#c7411a" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="seatParchment" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#3a2817" />
          <stop offset="100%" stopColor="#1e140a" />
        </linearGradient>
        <linearGradient id="seatActive" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#c7a869" />
          <stop offset="100%" stopColor="#8a6d3a" />
        </linearGradient>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Outer shadow ring */}
      <circle cx={cx} cy={cy} r={tableRadius + 10} fill="#000" opacity={0.6} />

      {/* Wooden table */}
      <circle cx={cx} cy={cy} r={tableRadius} fill="url(#tableWood)" stroke="#c7a869" strokeWidth={3} />
      <circle cx={cx} cy={cy} r={tableRadius - 14} fill="none" stroke="#8a6d3a" strokeWidth={1.5} opacity={0.8} />
      <circle cx={cx} cy={cy} r={tableRadius - 22} fill="none" stroke="#c7a869" strokeWidth={0.8} opacity={0.5} />

      {/* Central brazier glow */}
      <circle cx={cx} cy={cy} r={tableRadius - 30} fill="url(#brazierGlow)">
        <animate attributeName="opacity" values="0.75;1;0.75" dur="3s" repeatCount="indefinite" />
      </circle>
      <text x={cx} y={cy - 6} textAnchor="middle" dominantBaseline="middle" fontSize={Math.max(28, size / 14)} filter="url(#glow)">
        🔥
      </text>
      <text
        x={cx}
        y={cy + size / 16}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#c7a869"
        fontSize={Math.max(14, size / 24)}
        fontFamily="'Cinzel', 'Trajan Pro', serif"
        fontWeight="700"
        letterSpacing="4"
      >
        DARK OATH
      </text>

      {players.map((player, i) => {
        const angle = (i / count) * 2 * Math.PI - Math.PI / 2;
        const x = cx + radius * Math.cos(angle);
        const y = cy + radius * Math.sin(angle);

        const seat = player.seat;
        const name = player.name || `Siège ${seat}`;
        const seatSize = Math.max(38, size / 13);
        const isDisgraced = disgracedPlayerSeat === seat;
        const isSpeaking = speakingPlayers.includes(seat);
        const isRegent = regentSeat === seat;
        const isNominee = nomineeSeat === seat;
        const isActive = isRegent || isNominee;
        const isDead = player.alive === false;
        const hasVoted = showVoteSeals && player.id && votedSet.has(player.id) && !isRegent && !isNominee;

        return (
          <g key={seat} transform={`translate(${x}, ${y})`} opacity={isDead ? 0.35 : 1}>
            {isSpeaking && !isDead && (
              <>
                <circle cx={0} cy={0} r={seatSize / 2 + 10} fill="#ffb347" opacity={0.25}>
                  <animate attributeName="opacity" values="0.15;0.4;0.15" dur="1.4s" repeatCount="indefinite" />
                </circle>
                <circle cx={0} cy={0} r={seatSize / 2 + 5} fill="none" stroke="#ffb347" strokeWidth={2} opacity={0.9}>
                  <animate attributeName="opacity" values="0.5;1;0.5" dur="1.4s" repeatCount="indefinite" />
                </circle>
              </>
            )}

            {/* Seat shadow */}
            <rect
              x={-seatSize / 2 + 2}
              y={-seatSize / 2 + 3}
              width={seatSize}
              height={seatSize}
              rx={4}
              ry={4}
              fill="#000"
              opacity={0.5}
            />

            {/* Seat body */}
            <rect
              x={-seatSize / 2}
              y={-seatSize / 2}
              width={seatSize}
              height={seatSize}
              rx={4}
              ry={4}
              fill={isActive ? "url(#seatActive)" : "url(#seatParchment)"}
              stroke={
                isDisgraced ? "#6b4a28" :
                isSpeaking ? "#ffb347" :
                isRegent ? "#f4d88f" :
                isNominee ? "#c7a869" :
                isActive ? "#f4d88f" : "#8a6d3a"
              }
              strokeWidth={isSpeaking || isActive ? 2.5 : 1.5}
              opacity={isDisgraced ? 0.45 : 1}
            />

            {/* Role crown on Roi */}
            {isRegent && !isDead && (
              <text
                x={-seatSize / 2 - 4}
                y={-seatSize / 2 - 4}
                textAnchor="middle"
                fontSize={Math.max(18, size / 20)}
                filter="url(#glow)"
              >
                👑
              </text>
            )}

            {/* Key icon on Conseiller */}
            {isNominee && !isRegent && !isDead && (
              <text
                x={-seatSize / 2 - 4}
                y={-seatSize / 2 - 4}
                textAnchor="middle"
                fontSize={Math.max(16, size / 22)}
                filter="url(#glow)"
              >
                🗝️
              </text>
            )}

            {/* Voted seal (during VOTE phase only — value hidden) */}
            {hasVoted && (
              <g transform={`translate(${seatSize / 2 + 2}, ${-seatSize / 2 - 2})`}>
                <circle r={Math.max(9, size / 40)} fill="#5b3a1a" stroke="#c7a869" strokeWidth={1.5} />
                <text
                  y={Math.max(4, size / 90)}
                  textAnchor="middle"
                  fill="#ffeccc"
                  fontSize={Math.max(11, size / 34)}
                  fontFamily="'Cinzel', serif"
                  fontWeight="700"
                >
                  ✓
                </text>
              </g>
            )}

            {/* Disgraced mark */}
            {isDisgraced && (
              <text y={-seatSize / 2 - 20} textAnchor="middle" fill="#c7411a" fontSize={Math.max(16, size / 22)}>
                ⚡
              </text>
            )}

            {/* Dead mark */}
            {isDead && (
              <text
                y={6}
                textAnchor="middle"
                fill="#4a2a1a"
                fontSize={Math.max(20, size / 16)}
                fontFamily="'Cinzel', serif"
              >
                ✕
              </text>
            )}

            {/* Seat number — hide if dead since ✕ takes the spot */}
            {!isDead && (
              <text
                y={6}
                textAnchor="middle"
                fill={isActive ? "#1e140a" : (isDisgraced ? "#6b4a28" : "#c7a869")}
                fontSize={Math.max(12, size / 26)}
                fontFamily="'Cinzel', serif"
                fontWeight="700"
                opacity={isDisgraced ? 0.6 : 1}
              >
                {seat}
              </text>
            )}

            {/* Player name */}
            <text
              y={-seatSize / 2 - 8}
              textAnchor="middle"
              fill={isDisgraced || isDead ? "#6b4a28" : "#e8d9a8"}
              fontSize={Math.max(10, size / 32)}
              fontFamily="'Cinzel', 'IM Fell English', serif"
              fontWeight="500"
              opacity={isDisgraced || isDead ? 0.6 : 1}
              style={{ textShadow: "0 1px 2px rgba(0,0,0,0.8)" }}
            >
              <title>{name}</title>
              {name.length > 13 ? name.substring(0, 13) + "…" : name}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

export default MedievalTable;

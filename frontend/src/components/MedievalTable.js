import React from "react";

const MedievalTable = ({ players, size = 500, disgracedPlayerSeat = null }) => {
  const radius = size / 2 - 50;
  const tableRadius = size / 3;

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="mx-auto">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={tableRadius}
        fill="#374151"
        stroke="#6B7280"
        strokeWidth={4}
      />
      
      <circle
        cx={size / 2}
        cy={size / 2}
        r={tableRadius - 15}
        fill="none"
        stroke="#4B5563"
        strokeWidth={2}
        opacity={0.7}
      />
      
      <text
        x={size / 2}
        y={size / 2}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#E5E7EB"
        fontSize={Math.max(16, size / 20)}
        fontFamily="system-ui, -apple-system, sans-serif"
        fontWeight="600"
      >
        Table de Jeu
      </text>

      {Array.from({ length: 10 }).map((_, i) => {
        const angle = (i / 10) * 2 * Math.PI - Math.PI / 2;
        const x = size / 2 + radius * Math.cos(angle);
        const y = size / 2 + radius * Math.sin(angle);

        const player = players.find((p) => p.seat === i + 1);
        const name = player?.name || `Siège ${i + 1}`;
        const seatSize = Math.max(32, size / 15);
        const isDisgraced = disgracedPlayerSeat === i + 1;

        return (
          <g key={i} transform={`translate(${x}, ${y})`}>
            <rect
              x={-seatSize/2}
              y={-seatSize/2}
              width={seatSize}
              height={seatSize}
              rx={6}
              ry={6}
              fill={isDisgraced ? "#6B7280" : (player?.active ? "#DC2626" : "#4B5563")}
              stroke={isDisgraced ? "#9CA3AF" : (player?.active ? "#EF4444" : "#6B7280")}
              strokeWidth={2}
              opacity={isDisgraced ? 0.6 : 1}
            />
            
            {isDisgraced && (
              <text
                y={-seatSize/2 - 18}
                textAnchor="middle"
                fill="#EF4444"
                fontSize={Math.max(14, size / 22)}
                fontFamily="system-ui, -apple-system, sans-serif"
              >
                ⚡
              </text>
            )}
            
            <text
              y={4}
              textAnchor="middle"
              fill={isDisgraced ? "#9CA3AF" : "#F3F4F6"}
              fontSize={Math.max(11, size / 28)}
              fontFamily="system-ui, -apple-system, sans-serif"
              fontWeight="bold"
              opacity={isDisgraced ? 0.7 : 1}
            >
              {i + 1}
            </text>
            
            <text
              y={-seatSize/2 - 8}
              textAnchor="middle"
              fill={isDisgraced ? "#9CA3AF" : "#D1D5DB"}
              fontSize={Math.max(9, size / 32)}
              fontFamily="system-ui, -apple-system, sans-serif"
              opacity={isDisgraced ? 0.7 : 1}
            >
              {name.length > 10 ? name.substring(0, 10) + '...' : name}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

export default MedievalTable;
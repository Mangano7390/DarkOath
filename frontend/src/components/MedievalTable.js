import React from "react";

const MedievalTable = ({ players, size = 500 }) => {
  const radius = size / 2 - 50; // rayon où placer les chaises/pseudos
  const tableRadius = size / 3; // taille de la table ronde

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="mx-auto">
      {/* Table ronde - Style moderne sombre */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={tableRadius}
        fill="#374151"
        stroke="#6B7280"
        strokeWidth={4}
      />
      
      {/* Détails circulaires */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={tableRadius - 15}
        fill="none"
        stroke="#4B5563"
        strokeWidth={2}
        opacity={0.7}
      />
      
      {/* Text au centre - Modern clean */}
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

      {/* Sièges autour de la table - Style moderne */}
      {Array.from({ length: 10 }).map((_, i) => {
        const angle = (i / 10) * 2 * Math.PI - Math.PI / 2; // placement en cercle
        const x = size / 2 + radius * Math.cos(angle);
        const y = size / 2 + radius * Math.sin(angle);

        const player = players.find((p) => p.seat === i + 1);
        const name = player?.name || `Siège ${i + 1}`;
        const seatSize = Math.max(32, size / 15);

        return (
          <g key={i} transform={`translate(${x}, ${y})`}>
            {/* Siège/Chaise moderne */}
            <rect
              x={-seatSize/2}
              y={-seatSize/2}
              width={seatSize}
              height={seatSize}
              rx={6}
              ry={6}
              fill={player?.active ? "#DC2626" : "#4B5563"}
              stroke={player?.active ? "#EF4444" : "#6B7280"}
              strokeWidth={2}
            />
            
            {/* Numéro du siège */}
            <text
              y={4}
              textAnchor="middle"
              fill="#F3F4F6"
              fontSize={Math.max(11, size / 28)}
              fontFamily="system-ui, -apple-system, sans-serif"
              fontWeight="bold"
            >
              {i + 1}
            </text>
            
            {/* Nom du joueur */}
            <text
              y={-seatSize/2 - 8}
              textAnchor="middle"
              fill="#D1D5DB"
              fontSize={Math.max(9, size / 32)}
              fontFamily="system-ui, -apple-system, sans-serif"
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
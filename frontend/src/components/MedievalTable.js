import React from "react";

const MedievalTable = ({ players, size = 500 }) => {
  const radius = size / 2 - 50; // rayon où placer les chaises/pseudos
  const tableRadius = size / 3; // taille de la table ronde

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="mx-auto">
      {/* Table ronde - bois sombre */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={tableRadius}
        fill="#5c4033"
        stroke="#3b2a22"
        strokeWidth={6}
      />
      
      {/* Détails du bois */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={tableRadius - 15}
        fill="none"
        stroke="#4a3228"
        strokeWidth={2}
        opacity={0.7}
      />
      
      {/* Text au centre */}
      <text
        x={size / 2}
        y={size / 2}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#d1b075"
        fontSize={Math.max(16, size / 20)}
        fontFamily="serif"
        fontWeight="bold"
      >
        Table Ronde
      </text>

      {/* Sièges autour de la table */}
      {Array.from({ length: 10 }).map((_, i) => {
        const angle = (i / 10) * 2 * Math.PI - Math.PI / 2; // placement en cercle
        const x = size / 2 + radius * Math.cos(angle);
        const y = size / 2 + radius * Math.sin(angle);

        const player = players.find((p) => p.seat === i + 1);
        const name = player?.name || `Siège ${i + 1}`;
        const seatSize = Math.max(30, size / 16);

        return (
          <g key={i} transform={`translate(${x}, ${y})`}>
            {/* Siège/Chaise */}
            <rect
              x={-seatSize/2}
              y={-seatSize/2}
              width={seatSize}
              height={seatSize}
              rx={4}
              ry={4}
              fill={player?.active ? "#8b0000" : "#444"}
              stroke="#d1b075"
              strokeWidth={2}
            />
            
            {/* Numéro du siège */}
            <text
              y={5}
              textAnchor="middle"
              fill="#f5deb3"
              fontSize={Math.max(12, size / 25)}
              fontFamily="serif"
              fontWeight="bold"
            >
              {i + 1}
            </text>
            
            {/* Nom du joueur */}
            <text
              y={-seatSize/2 - 5}
              textAnchor="middle"
              fill="#f5deb3"
              fontSize={Math.max(10, size / 30)}
              fontFamily="serif"
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
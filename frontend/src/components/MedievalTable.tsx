import React from "react";

interface MedievalTableProps {
  players: { seat: number; name: string; active?: boolean }[];
  size?: number; // taille du SVG
}

export default function MedievalTable({ players, size = 500 }: MedievalTableProps) {
  const radius = size / 2 - 60; // rayon où placer les chaises/pseudos
  const tableRadius = size / 3; // taille de la table ronde

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="mx-auto">
      {/* Fond */}
      <rect width={size} height={size} fill="#1e1b16" />

      {/* Table ronde */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={tableRadius}
        fill="#5c4033"
        stroke="#3b2a22"
        strokeWidth={8}
      />
      <text
        x={size / 2}
        y={size / 2}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#d1b075"
        fontSize={24}
        fontFamily="serif"
      >
        Table Ronde
      </text>

      {/* Chaises */}
      {Array.from({ length: 10 }).map((_, i) => {
        const angle = (i / 10) * 2 * Math.PI - Math.PI / 2; // placement en cercle
        const x = size / 2 + radius * Math.cos(angle);
        const y = size / 2 + radius * Math.sin(angle);

        const player = players.find((p) => p.seat === i + 1);
        const name = player?.name || `Siège ${i + 1}`;

        return (
          <g key={i} transform={`translate(${x}, ${y})`}>
            {/* chaise */}
            <rect
              x={-20}
              y={-20}
              width={40}
              height={40}
              rx={6}
              ry={6}
              fill={player?.active ? "#8b0000" : "#444"}
              stroke="#d1b075"
              strokeWidth={2}
            />
            {/* pseudo */}
            <text
              y={-30}
              textAnchor="middle"
              fill="#f5deb3"
              fontSize={14}
              fontFamily="serif"
            >
              {name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
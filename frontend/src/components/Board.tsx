import React from 'react';
import { colors, sizes } from '../lib/theme';
import { Slot, CrisisToken, PowerToken } from './Tokens';
import '../styles/cards.css';

interface BoardProps {
  loyalCount?: number;    // 0..5
  conjureCount?: number;  // 0..6
  crisis?: 0 | 1 | 2 | 3;
  width?: number;         // responsive width
  onSlotClick?: (type: 'loyal' | 'conjure', index: number) => void;
  className?: string;
}

export default function Board({ 
  loyalCount = 0,
  conjureCount = 0,
  crisis = 0,
  width = sizes.boardW,
  onSlotClick,
  className = ''
}: BoardProps) {
  const aspectRatio = sizes.boardH / sizes.boardW;
  const height = width * aspectRatio;

  const handleSlotClick = (type: 'loyal' | 'conjure', index: number) => {
    if (onSlotClick) {
      onSlotClick(type, index);
    }
  };

  return (
    <div 
      className={`parchment-texture rounded-2xl shadow-2xl p-6 ${className}`}
      style={{ 
        width,
        height,
        backgroundColor: colors.parchment,
        border: `3px solid ${colors.stone}`
      }}
      role="img"
      aria-label={`Plateau de jeu - Décrets loyaux: ${loyalCount}/5, Décrets conjurés: ${conjureCount}/6, Crise: ${crisis}/3`}
    >
      <svg 
        viewBox={`0 0 ${sizes.boardW} ${sizes.boardH}`}
        className="w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="board-bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.2)" />
            <stop offset="50%" stopColor="rgba(0,0,0,0.05)" />
            <stop offset="100%" stopColor="rgba(139,69,19,0.1)" />
          </linearGradient>
        </defs>
        
        {/* Background texture */}
        <rect 
          x="0" y="0" 
          width={sizes.boardW} 
          height={sizes.boardH} 
          fill="url(#board-bg)"
          rx="20"
        />
        
        {/* Title */}
        <text 
          x={sizes.boardW / 2} y="60" 
          textAnchor="middle" 
          className="text-medieval"
          fontSize="36" 
          fontWeight="700"
          fill={colors.stone}
          letterSpacing="2px"
        >
          SECRETUS REGNUM
        </text>
        
        {/* Crisis Track */}
        <g transform="translate(600, 120)">
          <text 
            x="0" y="0" 
            textAnchor="middle" 
            className="text-medieval"
            fontSize="18" 
            fontWeight="600"
            fill={colors.crisis}
          >
            PISTE DE CRISE
          </text>
          
          <g transform="translate(0, 30)">
            {[0, 1, 2, 3].map((level) => (
              <g key={level} transform={`translate(${(level - 1.5) * 70}, 0)`}>
                <CrisisToken 
                  level={level as 0 | 1 | 2 | 3}
                  className={crisis >= level ? '' : 'opacity-30'}
                />
                <text 
                  x="0" y="45" 
                  textAnchor="middle" 
                  fontSize="12" 
                  fill={colors.stone}
                  opacity="0.7"
                >
                  {level}
                </text>
              </g>
            ))}
          </g>
          
          {crisis === 3 && (
            <text 
              x="0" y="100" 
              textAnchor="middle" 
              className="text-game-ui crisis-pulse"
              fontSize="14" 
              fontWeight="600"
              fill={colors.crisis}
            >
              ⚠ AUTO-ADOPTION ⚠
            </text>
          )}
        </g>
        
        {/* Loyal Decree Track */}
        <g transform="translate(150, 280)">
          <text 
            x="150" y="0" 
            textAnchor="middle" 
            className="text-medieval"
            fontSize="20" 
            fontWeight="600"
            fill={colors.loyal}
          >
            DÉCRETS LOYAUX
          </text>
          
          <g transform="translate(0, 40)">
            {[1, 2, 3, 4, 5].map((index) => (
              <g key={index} transform={`translate(${(index - 1) * 70}, 0)`}>
                <foreignObject x="-30" y="-30" width="60" height="60">
                  <Slot 
                    type="loyal"
                    filled={loyalCount >= index}
                    index={index}
                    onClick={() => handleSlotClick('loyal', index)}
                  />
                </foreignObject>
              </g>
            ))}
          </g>
          
          <text 
            x="150" y="100" 
            textAnchor="middle" 
            className="text-game-ui"
            fontSize="14" 
            fill={colors.loyal}
            opacity="0.8"
          >
            5 pour la victoire des Loyaux
          </text>
        </g>
        
        {/* Conjure Decree Track */}
        <g transform="translate(150, 450)">
          <text 
            x="210" y="0" 
            textAnchor="middle" 
            className="text-medieval"
            fontSize="20" 
            fontWeight="600"
            fill={colors.conjure}
          >
            DÉCRETS CONJURÉS
          </text>
          
          <g transform="translate(0, 40)">
            {[1, 2, 3, 4, 5, 6].map((index) => (
              <g key={index} transform={`translate(${(index - 1) * 70}, 0)`}>
                <foreignObject x="-30" y="-30" width="60" height="60">
                  <Slot 
                    type="conjure"
                    filled={conjureCount >= index}
                    index={index}
                    onClick={() => handleSlotClick('conjure', index)}
                  />
                </foreignObject>
                
                {/* Power thresholds */}
                {(index === 2 || index === 4) && (
                  <g transform="translate(0, 50)">
                    <foreignObject x="-24" y="-24" width="48" height="48">
                      <PowerToken 
                        type={index === 2 ? 'investigation' : 'execution'}
                        unlocked={conjureCount >= index}
                      />
                    </foreignObject>
                    <text 
                      x="0" y="65" 
                      textAnchor="middle" 
                      fontSize="10" 
                      fill={colors.stone}
                      opacity="0.7"
                    >
                      {index === 2 ? 'Investigation' : 'Exécution'}
                    </text>
                  </g>
                )}
              </g>
            ))}
          </g>
          
          <text 
            x="210" y="100" 
            textAnchor="middle" 
            className="text-game-ui"
            fontSize="14" 
            fill={colors.conjure}
            opacity="0.8"
          >
            6 pour la victoire des Conjurés
          </text>
        </g>
        
        {/* Rules Reminder */}
        <g transform="translate(50, 600)">
          <rect 
            x="0" y="0" 
            width="1100" height="80" 
            rx="10" 
            fill={colors.ivory}
            stroke={colors.stone}
            strokeWidth="1"
            opacity="0.9"
          />
          
          <text 
            x="550" y="25" 
            textAnchor="middle" 
            className="text-medieval"
            fontSize="16" 
            fontWeight="600"
            fill={colors.stone}
          >
            DÉROULEMENT DU TOUR
          </text>
          
          <text 
            x="550" y="50" 
            textAnchor="middle" 
            className="text-game-ui"
            fontSize="13" 
            fill={colors.stone}
            opacity="0.8"
          >
            1. Nomination → 2. Vote → 3. Session Législative → 4. Pouvoir (si débloqué) → 5. Tour suivant
          </text>
          
          <text 
            x="550" y="68" 
            textAnchor="middle" 
            className="text-game-ui"
            fontSize="11" 
            fill={colors.stone}
            opacity="0.6"
          >
            Si l'Usurpateur devient Chambellan après 3 Décrets Conjurés → Victoire immédiate des Conjurés
          </text>
        </g>
        
        {/* Decorative elements */}
        <g transform="translate(50, 50)">
          {/* Crown decoration */}
          <path 
            d="M -15 5 L -8 -10 L -2 0 L 2 -12 L 8 0 L 15 -10 L 22 5 L 18 15 L -11 15 Z" 
            fill={colors.loyalSeal}
            opacity="0.6"
          />
        </g>
        
        <g transform="translate(1150, 50)">
          {/* Dagger decoration */}
          <rect x="-2" y="-15" width="4" height="25" fill={colors.conjureSeal} opacity="0.6" />
          <path d="M 0 -18 L 6 -12 L 0 -8 L -6 -12 Z" fill={colors.conjureSeal} opacity="0.6" />
        </g>
      </svg>
    </div>
  );
}
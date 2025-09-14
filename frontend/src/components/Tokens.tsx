import React from 'react';
import { colors, sizes } from '../lib/theme';
import '../styles/cards.css';

// Crisis Token Component
interface CrisisTokenProps {
  level: 0 | 1 | 2 | 3;
  className?: string;
}

export function CrisisToken({ level, className = '' }: CrisisTokenProps) {
  const getIntensity = (level: number) => {
    const intensities = [0.3, 0.5, 0.7, 1.0];
    return intensities[level];
  };

  return (
    <div 
      className={`rounded-full flex items-center justify-center transition-all duration-300 ${
        level === 3 ? 'crisis-pulse' : ''
      } ${className}`}
      style={{ 
        width: sizes.tokenSize + 8,
        height: sizes.tokenSize + 8,
        backgroundColor: colors.crisis,
        opacity: Math.max(0.6, getIntensity(level))
      }}
      role="img" 
      aria-label={`Jeton de crise niveau ${level}`}
    >
      <svg width={sizes.tokenSize} height={sizes.tokenSize} viewBox="0 0 48 48">
        <defs>
          <radialGradient id={`crisis-${level}`} cx="30%" cy="30%" r="70%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.4)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.3)" />
          </radialGradient>
        </defs>
        
        <circle 
          cx="24" cy="24" r="22" 
          fill={`url(#crisis-${level})`}
          stroke={colors.ivory}
          strokeWidth="2"
        />
        
        <text 
          x="24" y="32" 
          textAnchor="middle" 
          className="text-medieval"
          fontSize="20" 
          fontWeight="700"
          fill={colors.ivory}
        >
          {level}
        </text>
      </svg>
    </div>
  );
}

// Decree Track Marker
interface DecreeMarkerProps {
  type: 'loyal' | 'conjure';
  position: number;
  active?: boolean;
  className?: string;
}

export function DecreeMarker({ type, position, active = false, className = '' }: DecreeMarkerProps) {
  const config = type === 'loyal' ? {
    color: colors.loyal,
    stroke: colors.loyalSeal,
    icon: 'shield'
  } : {
    color: colors.conjure,
    stroke: colors.conjureSeal,
    icon: 'dagger'
  };

  return (
    <div 
      className={`rounded-full flex items-center justify-center transition-all duration-300 ${
        active ? 'slot-active' : ''
      } ${className}`}
      style={{ 
        width: sizes.tokenSize,
        height: sizes.tokenSize,
        backgroundColor: active ? config.color : 'transparent',
        border: `2px solid ${config.stroke}`,
        transform: active ? 'scale(1.1)' : 'scale(1)'
      }}
      role="img" 
      aria-label={`Marqueur ${type} position ${position}${active ? ' actif' : ''}`}
    >
      <svg width="32" height="32" viewBox="0 0 32 32">
        {active && (
          <g>
            {config.icon === 'shield' ? (
              <path 
                d="M 8 6 L 24 6 L 24 14 C 24 20 16 26 16 26 C 16 26 8 20 8 14 Z" 
                fill={colors.ivory}
                opacity="0.9"
              />
            ) : (
              <g>
                <rect x="15" y="6" width="2" height="20" fill={colors.ivory} />
                <path d="M 16 4 L 20 8 L 16 10 L 12 8 Z" fill={colors.ivory} />
              </g>
            )}
          </g>
        )}
        
        <text 
          x="16" y="20" 
          textAnchor="middle" 
          fontSize="10" 
          fontWeight="600"
          fill={active ? colors.ivory : config.color}
        >
          {position}
        </text>
      </svg>
    </div>
  );
}

// Turn Marker (Arrow)
interface TurnMarkerProps {
  pointing?: 'up' | 'down' | 'left' | 'right';
  className?: string;
}

export function TurnMarker({ pointing = 'right', className = '' }: TurnMarkerProps) {
  const getRotation = (direction: string) => {
    const rotations = { up: 270, right: 0, down: 90, left: 180 };
    return rotations[direction as keyof typeof rotations] || 0;
  };

  return (
    <div 
      className={`flex items-center justify-center rounded-full brass-texture ${className}`}
      style={{ 
        width: sizes.tokenSize + 4,
        height: sizes.tokenSize + 4,
        transform: `rotate(${getRotation(pointing)}deg)`
      }}
      role="img" 
      aria-label="Marqueur de tour"
    >
      <svg width={sizes.tokenSize} height={sizes.tokenSize} viewBox="0 0 48 48">
        <defs>
          <linearGradient id="arrow-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={colors.loyalSeal} />
            <stop offset="100%" stopColor={colors.conjureSeal} />
          </linearGradient>
        </defs>
        
        <path 
          d="M 12 24 L 30 24 M 24 12 L 36 24 L 24 36" 
          stroke="url(#arrow-gradient)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    </div>
  );
}

// Power Icons
interface PowerTokenProps {
  type: 'investigation' | 'execution' | 'special_election';
  unlocked?: boolean;
  className?: string;
}

export function PowerToken({ type, unlocked = false, className = '' }: PowerTokenProps) {
  const getPowerConfig = (powerType: string) => {
    switch (powerType) {
      case 'investigation':
        return {
          icon: 'eye',
          color: colors.loyal,
          name: 'Investigation'
        };
      case 'execution':
        return {
          icon: 'sword',
          color: colors.no,
          name: 'Exécution'
        };
      case 'special_election':
        return {
          icon: 'crown',
          color: colors.loyalSeal,
          name: 'Élection Spéciale'
        };
      default:
        return {
          icon: 'question',
          color: colors.neutral,
          name: 'Pouvoir'
        };
    }
  };

  const config = getPowerConfig(type);

  return (
    <div 
      className={`rounded-full flex items-center justify-center transition-all duration-300 ${
        unlocked ? 'shadow-lg' : 'opacity-40'
      } ${className}`}
      style={{ 
        width: sizes.tokenSize,
        height: sizes.tokenSize,
        backgroundColor: unlocked ? config.color : colors.neutral,
        border: `2px solid ${unlocked ? colors.ivory : colors.stone}`
      }}
      role="img" 
      aria-label={`${config.name}${unlocked ? ' débloqué' : ' verrouillé'}`}
    >
      <svg width="28" height="28" viewBox="0 0 28 28">
        <g transform="translate(14,14)">
          {config.icon === 'eye' && (
            <g>
              <ellipse cx="0" cy="0" rx="10" ry="6" fill={colors.ivory} />
              <circle cx="0" cy="0" r="4" fill={colors.stone} />
              <circle cx="0" cy="0" r="2" fill={colors.ivory} />
            </g>
          )}
          
          {config.icon === 'sword' && (
            <g>
              <rect x="-1" y="-8" width="2" height="16" fill={colors.ivory} />
              <path d="M 0 -10 L 4 -6 L 0 -4 L -4 -6 Z" fill={colors.ivory} />
              <rect x="-3" y="6" width="6" height="4" fill={colors.conjureSeal} rx="1" />
            </g>
          )}
          
          {config.icon === 'crown' && (
            <g>
              <path 
                d="M -8 2 L -4 -6 L 0 -2 L 4 -6 L 8 2 L 6 8 L -6 8 Z" 
                fill={colors.ivory}
              />
              <circle cx="-4" cy="-2" r="1" fill={config.color} />
              <circle cx="4" cy="-2" r="1" fill={config.color} />
              <circle cx="0" cy="-4" r="1.5" fill={config.color} />
            </g>
          )}
        </g>
      </svg>
    </div>
  );
}

// Slot Component for Board
interface SlotProps {
  type?: 'loyal' | 'conjure';
  filled?: boolean;
  index?: number;
  className?: string;
  onClick?: () => void;
}

export function Slot({ 
  type = 'loyal', 
  filled = false, 
  index, 
  className = '',
  onClick 
}: SlotProps) {
  const config = type === 'loyal' ? {
    color: colors.loyal,
    stroke: colors.loyalSeal
  } : {
    color: colors.conjure,
    stroke: colors.conjureSeal
  };

  return (
    <div 
      className={`cursor-pointer transition-all duration-200 ${className}`}
      onClick={onClick}
      role="button"
      aria-label={`Emplacement ${type} ${index || ''}${filled ? ' rempli' : ' vide'}`}
    >
      <svg width={sizes.slotSize} height={sizes.slotSize} viewBox="0 0 60 60">
        <circle 
          cx="30" cy="30" r="26" 
          fill={filled ? config.color : 'transparent'}
          stroke={config.stroke}
          strokeWidth="3"
          strokeDasharray={filled ? "0" : "6 4"}
          className="transition-all duration-300"
        />
        
        {filled && (
          <g>
            <circle cx="30" cy="30" r="18" fill={colors.ivory} opacity="0.3" />
            {index && (
              <text 
                x="30" y="36" 
                textAnchor="middle" 
                fontSize="14" 
                fontWeight="700"
                fill={colors.ivory}
              >
                {index}
              </text>
            )}
          </g>
        )}
        
        {!filled && index && (
          <text 
            x="30" y="36" 
            textAnchor="middle" 
            fontSize="12" 
            fontWeight="500"
            fill={config.stroke}
            opacity="0.7"
          >
            {index}
          </text>
        )}
      </svg>
    </div>
  );
}
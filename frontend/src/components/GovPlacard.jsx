import React from 'react';
import { colors } from '../lib/theme';
import '../styles/cards.css';

type GovernmentRole = 'regent' | 'chambellan';

interface GovPlacardProps {
  role: GovernmentRole;
  playerName?: string;
  className?: string;
  active?: boolean;
}

export default function GovPlacard({ 
  role, 
  playerName,
  className = '',
  active = false
}: GovPlacardProps) {
  const getRoleConfig = (role: GovernmentRole) => {
    return role === 'regent' ? {
      title: 'RÉGENT',
      subtitle: 'Chef du Gouvernement',
      icon: 'crown',
      color: colors.loyalSeal
    } : {
      title: 'CHAMBELLAN',
      subtitle: 'Second du Gouvernement',
      icon: 'key',
      color: colors.conjureSeal
    };
  };

  const config = getRoleConfig(role);

  return (
    <div 
      className={`brass-texture rounded-lg shadow-lg border-2 transition-all duration-300 ${
        active ? 'ring-4 ring-offset-2 ring-yellow-400 shadow-xl' : ''
      } ${className}`}
      style={{
        width: 280,
        height: 80,
        borderColor: active ? colors.loyalSeal : 'rgba(212, 175, 55, 0.5)'
      }}
      role="img"
      aria-label={`Plaque ${config.title.toLowerCase()}${playerName ? ` - ${playerName}` : ''}`}
    >
      <svg 
        viewBox="0 0 280 80" 
        className="w-full h-full rounded-lg"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id={`placard-${role}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F4D03F" />
            <stop offset="30%" stopColor="#D4AF37" />
            <stop offset="70%" stopColor="#B8860B" />
            <stop offset="100%" stopColor="#CD853F" />
          </linearGradient>
          <linearGradient id={`placard-highlight-${role}`} x1="0%" y1="0%" x2="100%" y2="30%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.4)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.1)" />
          </linearGradient>
        </defs>
        
        {/* Main placard background */}
        <rect 
          x="2" y="2" 
          width="276" height="76" 
          rx="6" 
          fill={`url(#placard-${role})`}
          stroke="rgba(139, 69, 19, 0.6)"
          strokeWidth="1"
        />
        
        {/* Highlight overlay */}
        <rect 
          x="2" y="2" 
          width="276" height="25" 
          rx="6" 
          fill={`url(#placard-highlight-${role})`}
        />
        
        {/* Decorative corners */}
        <g opacity="0.7">
          <path d="M 10 10 L 20 10 L 15 15 Z" fill="rgba(139, 69, 19, 0.8)" />
          <path d="M 270 10 L 260 10 L 265 15 Z" fill="rgba(139, 69, 19, 0.8)" />
          <path d="M 10 70 L 20 70 L 15 65 Z" fill="rgba(139, 69, 19, 0.8)" />
          <path d="M 270 70 L 260 70 L 265 65 Z" fill="rgba(139, 69, 19, 0.8)" />
        </g>
        
        {/* Icon */}
        <g transform="translate(40,40)">
          {config.icon === 'crown' ? (
            /* Crown for Regent */
            <g>
              <path 
                d="M -20 5 L -12 -15 L -4 -5 L 0 -20 L 4 -5 L 12 -15 L 20 5 L 15 15 L -15 15 Z" 
                fill={colors.ivory}
                stroke="rgba(139, 69, 19, 0.8)"
                strokeWidth="1.5"
              />
              <circle cx="-8" cy="-8" r="2" fill="#E74C3C" />
              <circle cx="8" cy="-8" r="2" fill="#E74C3C" />
              <circle cx="0" cy="-12" r="3" fill="#3498DB" />
            </g>
          ) : (
            /* Key for Chambellan */
            <g>
              <circle cx="-8" cy="0" r="8" fill={colors.ivory} stroke="rgba(139, 69, 19, 0.8)" strokeWidth="1.5" />
              <circle cx="-8" cy="0" r="4" fill="none" stroke="rgba(139, 69, 19, 0.8)" strokeWidth="1.5" />
              <rect x="0" y="-2" width="16" height="4" fill={colors.ivory} stroke="rgba(139, 69, 19, 0.8)" strokeWidth="1" />
              <rect x="12" y="-6" width="4" height="4" fill={colors.ivory} />
              <rect x="12" y="2" width="4" height="4" fill={colors.ivory} />
            </g>
          )}
        </g>
        
        {/* Title */}
        <text 
          x="140" y="30" 
          textAnchor="middle" 
          className="text-medieval"
          fontSize="16" 
          fontWeight="700"
          fill={colors.stone}
          letterSpacing="1px"
        >
          {config.title}
        </text>
        
        {/* Subtitle */}
        <text 
          x="140" y="48" 
          textAnchor="middle" 
          className="text-game-ui"
          fontSize="10" 
          fill={colors.stone}
          opacity="0.8"
        >
          {config.subtitle}
        </text>
        
        {/* Player name */}
        {playerName && (
          <text 
            x="140" y="65" 
            textAnchor="middle" 
            className="text-game-ui"
            fontSize="12" 
            fontWeight="600"
            fill={colors.bg}
          >
            {playerName}
          </text>
        )}
      </svg>
    </div>
  );
}
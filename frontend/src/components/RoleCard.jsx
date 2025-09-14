import React from 'react';
import { colors, sizes } from '../lib/theme';
import '../styles/cards.css';

type RoleType = 'LOYAL' | 'CONJURE' | 'USURPATEUR';

interface RoleCardProps {
  type: RoleType;
  className?: string;
  revealed?: boolean;
}

export default function RoleCard({ 
  type, 
  className = '',
  revealed = true 
}: RoleCardProps) {
  const getRoleConfig = (role: RoleType) => {
    switch (role) {
      case 'LOYAL':
        return {
          bg: colors.parchment,
          primary: colors.loyal,
          secondary: colors.loyalSeal,
          title: 'CHEVALIER LOYAL',
          subtitle: 'Vous êtes Loyal',
          description: 'Défendez le royaume et démasquez les traîtres'
        };
      case 'CONJURE':
        return {
          bg: colors.parchmentDark,
          primary: colors.conjure,
          secondary: colors.conjureSeal,
          title: 'CONJURÉ',
          subtitle: 'Vous êtes Conjuré',
          description: 'Répandez le chaos et aidez l\'Usurpateur'
        };
      case 'USURPATEUR':
        return {
          bg: colors.parchmentDark,
          primary: '#4A148C',
          secondary: '#7B1FA2',
          title: 'USURPATEUR',
          subtitle: 'Vous êtes l\'Usurpateur',
          description: 'Prenez le pouvoir en secret'
        };
      default:
        return {
          bg: colors.stone,
          primary: colors.neutral,
          secondary: colors.neutral,
          title: 'RÔLE INCONNU',
          subtitle: 'Rôle secret',
          description: ''
        };
    }
  };

  const config = getRoleConfig(type);

  if (!revealed) {
    return (
      <div 
        className={`card-shadow rounded-xl parchment-texture ${className}`}
        style={{ 
          width: sizes.cardW, 
          aspectRatio: `${sizes.cardW}/${sizes.cardH}`, 
          backgroundColor: colors.stone 
        }}
        role="img"
        aria-label="Carte rôle cachée"
      >
        <svg viewBox="0 0 252 352" className="w-full h-full rounded-xl">
          <rect x="8" y="8" width="236" height="336" rx="12" fill={colors.neutral} opacity="0.3"/>
          <g transform="translate(126,176)">
            <circle r="30" fill={colors.stone} stroke={colors.neutral} strokeWidth="2"/>
            <text textAnchor="middle" y="6" fontSize="24" fill={colors.ivory}>?</text>
          </g>
          <text x="126" y="280" textAnchor="middle" fontSize="14" fill={colors.ivory}>
            RÔLE SECRET
          </text>
        </svg>
      </div>
    );
  }

  return (
    <div 
      className={`card-shadow card-hover parchment-texture rounded-xl ${className}`}
      style={{ 
        width: sizes.cardW, 
        aspectRatio: `${sizes.cardW}/${sizes.cardH}`, 
        backgroundColor: config.bg 
      }}
      role="img"
      aria-label={`Carte ${config.title.toLowerCase()}`}
    >
      <svg 
        viewBox="0 0 252 352" 
        className="w-full h-full rounded-xl"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id={`role-bg-${type}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.2)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.1)" />
          </linearGradient>
          <radialGradient id={`role-icon-${type}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={config.primary} />
            <stop offset="100%" stopColor={config.secondary} />
          </radialGradient>
        </defs>
        
        {/* Card background */}
        <rect 
          x="6" y="6" 
          width="240" height="340" 
          rx="12" 
          fill={`url(#role-bg-${type})`}
          stroke={config.secondary}
          strokeWidth="1"
        />
        
        {/* Role icon background */}
        <g transform="translate(126,120)">
          <circle 
            r="50" 
            fill={`url(#role-icon-${type})`}
            stroke={config.secondary}
            strokeWidth="3"
            className="seal-glow"
          />
          
          {/* Role-specific icons */}
          {type === 'LOYAL' && (
            <g>
              {/* Shield */}
              <path 
                d="M -20 -25 L 20 -25 L 20 -8 C 20 12 0 28 0 28 C 0 28 -20 12 -20 -8 Z" 
                fill={colors.ivory} 
                stroke={config.primary}
                strokeWidth="2"
                opacity="0.9"
              />
              {/* Cross on shield */}
              <path d="M -2 -15 L 2 -15 L 2 5 L -2 5 Z" fill={config.primary} />
              <path d="M -12 -7 L 12 -7 L 12 -3 L -12 -3 Z" fill={config.primary} />
            </g>
          )}
          
          {type === 'CONJURE' && (
            <g>
              {/* Hooded figure */}
              <path 
                d="M -25 -20 C -25 -35 -10 -45 0 -45 C 10 -45 25 -35 25 -20 L 25 20 L -25 20 Z" 
                fill={colors.stone}
                opacity="0.8"
              />
              {/* Dagger */}
              <rect x="-2" y="-10" width="4" height="25" fill={colors.ivory} rx="1"/>
              <path d="M 0 -15 L 6 -8 L 0 -5 L -6 -8 Z" fill={colors.ivory}/>
              {/* Hidden eyes */}
              <circle cx="-8" cy="-20" r="2" fill={config.secondary}/>
              <circle cx="8" cy="-20" r="2" fill={config.secondary}/>
            </g>
          )}
          
          {type === 'USURPATEUR' && (
            <g>
              {/* Broken crown */}
              <path 
                d="M -30 0 L -20 -25 L -10 -15 L 0 -30 L 10 -15 L 20 -25 L 30 0 L 25 10 L -25 10 Z" 
                fill={colors.ivory}
                stroke={config.primary}
                strokeWidth="2"
              />
              {/* Crack in crown */}
              <path 
                d="M -5 -20 L -3 -5 L 3 -15 L 5 0" 
                stroke={config.primary}
                strokeWidth="3"
                fill="none"
                opacity="0.7"
              />
              {/* Jewels */}
              <circle cx="-15" cy="-12" r="3" fill={config.secondary}/>
              <circle cx="15" cy="-12" r="3" fill={config.secondary}/>
              <circle cx="0" cy="-18" r="4" fill={config.secondary}/>
            </g>
          )}
        </g>
        
        {/* Role title */}
        <text 
          x="126" y="220" 
          textAnchor="middle" 
          className="text-medieval text-on-parchment"
          fontSize="18" 
          fontWeight="700"
          fill={config.primary}
          letterSpacing="0.5px"
        >
          {config.title}
        </text>
        
        {/* Subtitle */}
        <text 
          x="126" y="245" 
          textAnchor="middle" 
          className="text-game-ui"
          fontSize="14" 
          fontWeight="500"
          fill={colors.stone}
        >
          {config.subtitle}
        </text>
        
        {/* Description */}
        <foreignObject x="20" y="260" width="212" height="60">
          <div 
            className="text-center text-game-ui text-on-parchment"
            style={{ 
              fontSize: '11px', 
              color: colors.stone, 
              opacity: 0.8,
              lineHeight: '1.4'
            }}
          >
            {config.description}
          </div>
        </foreignObject>
        
        {/* Decorative border */}
        <rect 
          x="8" y="8" 
          width="236" height="336" 
          rx="10" 
          fill="none" 
          stroke={config.secondary}
          strokeWidth="1"
          strokeDasharray="6 3"
          opacity="0.5"
        />
      </svg>
    </div>
  );
}
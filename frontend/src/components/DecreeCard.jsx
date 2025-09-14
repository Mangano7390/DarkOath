import React from 'react';
import { colors, sizes } from '../lib/theme';
import '../styles/cards.css';

type DecreeType = 'loyal' | 'conjure';

interface DecreeCardProps {
  type: DecreeType;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
}

export default function DecreeCard({ 
  type = 'loyal', 
  className = '',
  onClick,
  disabled = false
}: DecreeCardProps) {
  const bg = type === 'loyal' ? colors.parchment : colors.parchmentDark;
  const sealColor = type === 'loyal' ? colors.loyal : colors.conjure;
  const sealStroke = type === 'loyal' ? colors.loyalSeal : colors.conjureSeal;
  const label = type === 'loyal' ? 'DÉCRET LOYAL' : 'DÉCRET CONJURÉ';
  
  return (
    <div 
      className={`card-shadow card-hover parchment-texture rounded-xl cursor-pointer transition-all duration-200 ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      } ${className}`}
      style={{ 
        width: sizes.cardW, 
        aspectRatio: `${sizes.cardW}/${sizes.cardH}`, 
        backgroundColor: bg 
      }}
      onClick={disabled ? undefined : onClick}
      role="img"
      aria-label={`Carte ${label.toLowerCase()}`}
    >
      <svg 
        viewBox="0 0 252 352" 
        className="w-full h-full rounded-xl"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id={`paper-${type}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.25)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.1)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.08)" />
          </linearGradient>
          <linearGradient id={`seal-gradient-${type}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.2)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.3)" />
          </linearGradient>
        </defs>
        
        {/* Card background with texture */}
        <rect 
          x="6" y="6" 
          width="240" height="340" 
          rx="12" 
          fill={`url(#paper-${type})`}
          stroke={sealStroke}
          strokeWidth="1"
          opacity="0.3"
        />
        
        {/* Decorative corner elements */}
        <g opacity="0.6">
          <path 
            d="M 20 20 L 35 20 L 35 25 L 25 25 L 25 35 L 20 35 Z" 
            fill={sealStroke}
          />
          <path 
            d="M 232 20 L 217 20 L 217 25 L 227 25 L 227 35 L 232 35 Z" 
            fill={sealStroke}
          />
          <path 
            d="M 20 332 L 35 332 L 35 327 L 25 327 L 25 317 L 20 317 Z" 
            fill={sealStroke}
          />
          <path 
            d="M 232 332 L 217 332 L 217 327 L 227 327 L 227 317 L 232 317 Z" 
            fill={sealStroke}
          />
        </g>
        
        {/* Main seal */}
        <g transform="translate(126,140)">
          <circle 
            r="40" 
            fill={sealColor} 
            stroke={sealStroke} 
            strokeWidth="3"
            filter={`url(#seal-gradient-${type})`}
            className="seal-glow"
          />
          
          {/* Loyal emblem - Shield */}
          {type === 'loyal' ? (
            <g>
              <path 
                d="M -15 -18 L 15 -18 L 15 -5 C 15 8 0 20 0 20 C 0 20 -15 8 -15 -5 Z" 
                fill={colors.parchment} 
                stroke={colors.ivory}
                strokeWidth="1"
                opacity="0.95"
              />
              <path 
                d="M -8 -12 L 8 -12 L 8 -3 C 8 5 0 10 0 10 C 0 10 -8 5 -8 -3 Z" 
                fill={sealColor}
                opacity="0.7"
              />
            </g>
          ) : (
            /* Conjure emblem - Dagger */
            <g>
              <rect 
                x="-2" y="-20" 
                width="4" height="35" 
                fill={colors.parchment} 
                rx="1"
              />
              <path 
                d="M 0 -25 L 8 -15 L 0 -10 L -8 -15 Z" 
                fill={colors.parchment}
                stroke={colors.ivory}
                strokeWidth="0.5"
              />
              <rect 
                x="-6" y="12" 
                width="12" height="6" 
                fill={sealStroke}
                rx="2"
              />
            </g>
          )}
        </g>
        
        {/* Title text */}
        <text 
          x="126" y="250" 
          textAnchor="middle" 
          className="text-medieval text-on-parchment"
          fontSize="16" 
          fontWeight="600"
          fill={colors.stone}
          letterSpacing="1px"
        >
          {label}
        </text>
        
        {/* Subtitle */}
        <text 
          x="126" y="280" 
          textAnchor="middle" 
          className="text-game-ui"
          fontSize="11" 
          fill={colors.stone}
          opacity="0.8"
        >
          {type === 'loyal' ? 'Ordre et Stabilité' : 'Chaos et Révolution'}
        </text>
        
        {/* Decorative border pattern */}
        <rect 
          x="8" y="8" 
          width="236" height="336" 
          rx="10" 
          fill="none" 
          stroke={sealStroke}
          strokeWidth="1"
          strokeDasharray="8 4"
          opacity="0.4"
        />
      </svg>
    </div>
  );
}
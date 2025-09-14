import React from 'react';
import { colors, sizes } from '../lib/theme';
import '../styles/cards.css';

type VoteType = 'oui' | 'non';

interface VoteTokenProps {
  type: VoteType;
  size?: 'small' | 'medium' | 'large';
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  selected?: boolean;
}

export default function VoteToken({ 
  type, 
  size = 'medium',
  className = '',
  onClick,
  disabled = false,
  selected = false
}: VoteTokenProps) {
  const getSizeConfig = (size: string) => {
    switch (size) {
      case 'small': return { width: 48, height: 48, fontSize: 12, iconSize: 16 };
      case 'large': return { width: 120, height: 120, fontSize: 24, iconSize: 40 };
      default: return { width: 80, height: 80, fontSize: 18, iconSize: 28 };
    }
  };

  const getVoteConfig = (vote: VoteType) => {
    return vote === 'oui' ? {
      bg: colors.ok,
      text: colors.ivory,
      label: 'OUI',
      shadow: 'rgba(31, 169, 122, 0.4)',
      icon: 'check'
    } : {
      bg: colors.no,
      text: colors.ivory,
      label: 'NON',
      shadow: 'rgba(192, 57, 43, 0.4)',
      icon: 'cross'
    };
  };

  const sizeConfig = getSizeConfig(size);
  const voteConfig = getVoteConfig(type);

  return (
    <div 
      className={`card-hover rounded-full cursor-pointer transition-all duration-200 flex items-center justify-center ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      } ${selected ? 'ring-4 ring-offset-2' : ''} ${className}`}
      style={{ 
        width: sizeConfig.width,
        height: sizeConfig.height,
        backgroundColor: voteConfig.bg,
        boxShadow: selected 
          ? `0 0 20px ${voteConfig.shadow}, 0 4px 15px rgba(0,0,0,0.3)`
          : `0 4px 15px ${voteConfig.shadow}`,
        ringColor: selected ? voteConfig.bg : undefined
      }}
      onClick={disabled ? undefined : onClick}
      role="button"
      aria-label={`Vote ${voteConfig.label.toLowerCase()}`}
      tabIndex={disabled ? -1 : 0}
    >
      <svg 
        width={sizeConfig.width - 8} 
        height={sizeConfig.height - 8} 
        viewBox="0 0 100 100"
        className="w-full h-full"
      >
        <defs>
          <radialGradient id={`vote-gradient-${type}`} cx="30%" cy="30%" r="70%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.3)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.2)" />
          </radialGradient>
        </defs>
        
        {/* Background circle with gradient */}
        <circle 
          cx="50" cy="50" r="48" 
          fill={`url(#vote-gradient-${type})`}
          stroke="rgba(255,255,255,0.3)"
          strokeWidth="1"
        />
        
        {/* Icon */}
        <g transform="translate(50,35)">
          {voteConfig.icon === 'check' ? (
            /* Check mark for OUI */
            <path 
              d="M -12 0 L -4 8 L 12 -8" 
              stroke={voteConfig.text}
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          ) : (
            /* X mark for NON */
            <g>
              <path 
                d="M -10 -10 L 10 10" 
                stroke={voteConfig.text}
                strokeWidth="4"
                strokeLinecap="round"
              />
              <path 
                d="M 10 -10 L -10 10" 
                stroke={voteConfig.text}
                strokeWidth="4"
                strokeLinecap="round"
              />
            </g>
          )}
        </g>
        
        {/* Text label */}
        <text 
          x="50" y="70" 
          textAnchor="middle" 
          className="text-medieval"
          fontSize={sizeConfig.fontSize}
          fontWeight="700"
          fill={voteConfig.text}
          letterSpacing="1px"
        >
          {voteConfig.label}
        </text>
      </svg>
    </div>
  );
}

// Compact icon-only version
export function VoteIcon({ type, className = '' }: { type: VoteType, className?: string }) {
  return (
    <VoteToken 
      type={type} 
      size="small" 
      className={className}
    />
  );
}
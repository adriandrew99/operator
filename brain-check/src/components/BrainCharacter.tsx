import { useState } from 'react';

interface BrainCharacterProps {
  healthScore: number;
  size?: number;
  onTap?: () => void;
}

export default function BrainCharacter({ healthScore, size = 200, onTap }: BrainCharacterProps) {
  const [tapped, setTapped] = useState(false);

  const handleTap = () => {
    setTapped(true);
    onTap?.();
    setTimeout(() => setTapped(false), 300);
  };

  // Colors based on health
  const brainColor = healthScore >= 70 ? '#e8b4f8' : healthScore >= 40 ? '#d4a0d0' : '#b88a9a';
  const glowColor = healthScore >= 70 ? '#5ecc8b' : healthScore >= 40 ? '#f0c060' : '#e06060';
  const cheekColor = healthScore >= 60 ? '#ffb3c6' : 'transparent';

  // Eye expression
  const eyeStyle = healthScore >= 70 ? 'happy' : healthScore >= 40 ? 'neutral' : 'sad';

  // Mouth expression
  const getMouthPath = () => {
    if (healthScore >= 70) {
      // Big smile
      return 'M 80 135 Q 100 155 120 135';
    } else if (healthScore >= 40) {
      // Slight smile
      return 'M 85 138 Q 100 145 115 138';
    } else {
      // Sad frown
      return 'M 85 145 Q 100 135 115 145';
    }
  };

  const isGlowing = healthScore >= 70;

  return (
    <div
      className={`cursor-pointer select-none ${tapped ? 'brain-tap' : 'brain-idle'} ${isGlowing ? 'brain-glow' : ''}`}
      onClick={handleTap}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 200 200" width={size} height={size}>
        {/* Glow effect */}
        <defs>
          <radialGradient id="brainGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={glowColor} stopOpacity="0.15" />
            <stop offset="100%" stopColor={glowColor} stopOpacity="0" />
          </radialGradient>
          <radialGradient id="brainGrad" cx="40%" cy="35%" r="60%">
            <stop offset="0%" stopColor={brainColor} />
            <stop offset="100%" stopColor={darken(brainColor, 20)} />
          </radialGradient>
        </defs>

        {/* Background glow */}
        <circle cx="100" cy="100" r="95" fill="url(#brainGlow)" />

        {/* Brain body - rounded blobby shape */}
        <path
          d={`
            M 60 65
            C 40 55, 30 75, 35 95
            C 30 105, 35 130, 55 145
            C 65 155, 80 160, 100 160
            C 120 160, 135 155, 145 145
            C 165 130, 170 105, 165 95
            C 170 75, 160 55, 140 65
            C 135 50, 120 40, 100 42
            C 80 40, 65 50, 60 65
            Z
          `}
          fill="url(#brainGrad)"
          stroke={darken(brainColor, 30)}
          strokeWidth="1.5"
        />

        {/* Brain fold lines */}
        <path
          d="M 70 80 Q 85 70, 100 80 Q 115 90, 130 80"
          fill="none"
          stroke={darken(brainColor, 25)}
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.5"
        />
        <path
          d="M 55 105 Q 75 95, 95 105"
          fill="none"
          stroke={darken(brainColor, 25)}
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.4"
        />
        <path
          d="M 105 100 Q 125 90, 150 100"
          fill="none"
          stroke={darken(brainColor, 25)}
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.4"
        />
        <path
          d="M 65 125 Q 85 115, 100 125 Q 115 135, 135 125"
          fill="none"
          stroke={darken(brainColor, 25)}
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.3"
        />

        {/* Center divider line */}
        <path
          d="M 100 50 Q 98 80, 100 110 Q 102 130, 100 155"
          fill="none"
          stroke={darken(brainColor, 25)}
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.4"
        />

        {/* Eyes */}
        {eyeStyle === 'happy' ? (
          <>
            {/* Happy eyes (curved arcs) */}
            <path d="M 72 100 Q 80 90, 88 100" fill="none" stroke="#2d2a26" strokeWidth="3" strokeLinecap="round" />
            <path d="M 112 100 Q 120 90, 128 100" fill="none" stroke="#2d2a26" strokeWidth="3" strokeLinecap="round" />
          </>
        ) : eyeStyle === 'neutral' ? (
          <>
            {/* Neutral eyes (dots) */}
            <circle cx="80" cy="97" r="5" fill="#2d2a26" />
            <circle cx="120" cy="97" r="5" fill="#2d2a26" />
            {/* Eye shine */}
            <circle cx="82" cy="95" r="1.5" fill="white" opacity="0.8" />
            <circle cx="122" cy="95" r="1.5" fill="white" opacity="0.8" />
          </>
        ) : (
          <>
            {/* Sad eyes (downward) */}
            <circle cx="80" cy="100" r="5" fill="#2d2a26" />
            <circle cx="120" cy="100" r="5" fill="#2d2a26" />
            {/* Sad eyebrows */}
            <path d="M 68 88 Q 76 84, 88 90" fill="none" stroke="#2d2a26" strokeWidth="2" strokeLinecap="round" />
            <path d="M 132 88 Q 124 84, 112 90" fill="none" stroke="#2d2a26" strokeWidth="2" strokeLinecap="round" />
            {/* Tear */}
            <ellipse cx="87" cy="108" rx="2" ry="3" fill="#7ec8e3" opacity="0.7" />
          </>
        )}

        {/* Cheeks */}
        <circle cx="65" cy="115" r="8" fill={cheekColor} opacity="0.4" />
        <circle cx="135" cy="115" r="8" fill={cheekColor} opacity="0.4" />

        {/* Mouth */}
        <path
          d={getMouthPath()}
          fill="none"
          stroke="#2d2a26"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* Sparkles for high score */}
        {healthScore >= 80 && (
          <>
            <SparkleIcon x={35} y={55} size={10} delay={0} />
            <SparkleIcon x={160} y={60} size={8} delay={0.5} />
            <SparkleIcon x={150} y={155} size={9} delay={1} />
            <SparkleIcon x={45} y={150} size={7} delay={1.5} />
          </>
        )}

        {/* Stink lines for low score */}
        {healthScore < 25 && (
          <>
            <StinkLine x={50} y={50} />
            <StinkLine x={145} y={55} />
          </>
        )}
      </svg>
    </div>
  );
}

function SparkleIcon({ x, y, size, delay }: { x: number; y: number; size: number; delay: number }) {
  return (
    <g>
      <line
        x1={x} y1={y - size} x2={x} y2={y + size}
        stroke="#f0c060" strokeWidth="1.5" strokeLinecap="round"
        opacity="0.8"
      >
        <animate attributeName="opacity" values="0.4;1;0.4" dur="1.5s" begin={`${delay}s`} repeatCount="indefinite" />
      </line>
      <line
        x1={x - size} y1={y} x2={x + size} y2={y}
        stroke="#f0c060" strokeWidth="1.5" strokeLinecap="round"
        opacity="0.8"
      >
        <animate attributeName="opacity" values="0.4;1;0.4" dur="1.5s" begin={`${delay}s`} repeatCount="indefinite" />
      </line>
    </g>
  );
}

function StinkLine({ x, y }: { x: number; y: number }) {
  return (
    <path
      d={`M ${x} ${y} Q ${x - 3} ${y - 10}, ${x + 3} ${y - 18} Q ${x - 2} ${y - 25}, ${x + 2} ${y - 32}`}
      fill="none"
      stroke="#a8a080"
      strokeWidth="1.5"
      strokeLinecap="round"
      opacity="0.4"
    >
      <animate attributeName="opacity" values="0.2;0.5;0.2" dur="2s" repeatCount="indefinite" />
    </path>
  );
}

function darken(hex: string, amount: number): string {
  const num = parseInt(hex.slice(1), 16);
  const r = Math.max(0, (num >> 16) - amount);
  const g = Math.max(0, ((num >> 8) & 0xff) - amount);
  const b = Math.max(0, (num & 0xff) - amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

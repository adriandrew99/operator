import { getScoreColor } from '../store';

interface ProgressRingProps {
  score: number;
  rulesHeld: number;
  totalRules: number;
  size?: number;
}

export default function ProgressRing({ score, rulesHeld, totalRules, size = 220 }: ProgressRingProps) {
  const radius = 85;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = getScoreColor(score);

  const segments = totalRules;
  const segmentAngle = 360 / segments;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 200 200" width={size} height={size} className="transform -rotate-90">
        {/* Background track */}
        <circle
          cx="100" cy="100" r={radius}
          fill="none"
          stroke="#f0ece6"
          strokeWidth="12"
          strokeLinecap="round"
        />
        {/* Progress arc */}
        <circle
          cx="100" cy="100" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="animate-ring transition-all duration-700 ease-out"
          style={{ filter: `drop-shadow(0 0 8px ${color}40)` }}
        />
        {/* Rule segment dots around the ring */}
        {Array.from({ length: segments }).map((_, i) => {
          const angle = (i * segmentAngle - 90) * (Math.PI / 180);
          const dotRadius = radius + 16;
          const cx = 100 + dotRadius * Math.cos(angle);
          const cy = 100 + dotRadius * Math.sin(angle);
          const isHeld = i < rulesHeld;

          return (
            <circle
              key={i}
              cx={cx} cy={cy} r="4"
              fill={isHeld ? color : '#e0dcd6'}
              className="transition-all duration-300"
              style={isHeld ? { filter: `drop-shadow(0 0 4px ${color}60)` } : {}}
            />
          );
        })}
      </svg>
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div
          className="text-5xl font-extrabold transition-all duration-500"
          style={{ color }}
        >
          {score}
        </div>
        <div className="text-xs font-bold text-[#9ca3af] uppercase tracking-wider mt-0.5">
          Health Score
        </div>
      </div>
    </div>
  );
}

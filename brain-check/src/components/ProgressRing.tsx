interface ProgressRingProps {
  score: number;
  rulesHeld: number;
  totalRules: number;
  size?: number;
}

export default function ProgressRing({ score, rulesHeld, totalRules, size = 200 }: ProgressRingProps) {
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  // Color based on score
  const color = score >= 70 ? '#22c55e' : score >= 40 ? '#f59e0b' : score >= 1 ? '#ef4444' : '#3b3b50';

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 200 200" width={size} height={size} className="transform -rotate-90">
        {/* Glow */}
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="4" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* Track */}
        <circle cx="100" cy="100" r={radius} fill="none" stroke="#1e1e2e" strokeWidth="10" />
        {/* Progress */}
        <circle
          cx="100" cy="100" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="animate-ring transition-all duration-700"
          filter={score > 0 ? 'url(#glow)' : undefined}
        />
      </svg>
      {/* Center */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-4xl font-extrabold transition-all duration-500" style={{ color }}>
          {score}
        </div>
        <div className="text-[10px] font-bold text-[#6b6b80] uppercase tracking-widest mt-1">
          Health
        </div>
        <div className="flex gap-1 mt-2">
          {Array.from({ length: totalRules }).map((_, i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full transition-all duration-300"
              style={{
                backgroundColor: i < rulesHeld ? color : '#2a2a3a',
                boxShadow: i < rulesHeld ? `0 0 6px ${color}60` : 'none',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

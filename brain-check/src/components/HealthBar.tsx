import { getScoreColor, getScoreLabel } from '../store';

interface HealthBarProps {
  score: number;
  showLabel?: boolean;
}

export default function HealthBar({ score, showLabel = true }: HealthBarProps) {
  const color = getScoreColor(score);
  const label = getScoreLabel(score);

  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color }}>
              {label}
            </span>
          </div>
          <span className="text-sm font-extrabold" style={{ color }}>
            {score}<span className="text-[#9ca3af] font-semibold">/100</span>
          </span>
        </div>
      )}
      <div className="w-full h-2.5 bg-[#f0ece6] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out relative overflow-hidden"
          style={{
            width: `${Math.max(score, 2)}%`,
            background: `linear-gradient(90deg, ${color}, ${color}dd)`,
          }}
        >
          {score > 20 && <div className="absolute inset-0 shimmer" />}
        </div>
      </div>
    </div>
  );
}

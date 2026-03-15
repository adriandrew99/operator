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
          <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color }}>{label}</span>
          <span className="text-sm font-extrabold" style={{ color }}>
            {score}<span className="text-[#6b6b80] font-semibold">/100</span>
          </span>
        </div>
      )}
      <div className="w-full h-2 bg-white/[0.06] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out relative overflow-hidden"
          style={{ width: `${Math.max(score, 2)}%`, backgroundColor: color }}
        >
          {score > 20 && <div className="absolute inset-0 shimmer" />}
        </div>
      </div>
    </div>
  );
}

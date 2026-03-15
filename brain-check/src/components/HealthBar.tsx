import { getScoreColor, getScoreLabel } from '../store';

interface HealthBarProps {
  score: number;
}

export default function HealthBar({ score }: HealthBarProps) {
  const color = getScoreColor(score);
  const label = getScoreLabel(score);

  return (
    <div className="w-full">
      <div className="flex justify-between items-baseline mb-1.5">
        <span className="text-sm font-bold" style={{ color }}>
          {label}
        </span>
        <span className="text-2xl font-extrabold" style={{ color }}>
          {score}
          <span className="text-sm font-semibold text-[#8a8680]">/100</span>
        </span>
      </div>
      <div className="w-full h-3 bg-[#e8e4de] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${score}%`,
            background: `linear-gradient(90deg, ${color}cc, ${color})`,
          }}
        />
      </div>
    </div>
  );
}

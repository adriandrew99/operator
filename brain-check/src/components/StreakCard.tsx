import { useCallback } from 'react';
import { getScoreColor } from '../store';

interface StreakCardProps {
  streak: number;
  healthScore: number;
  dayNumber: number;
}

export default function StreakCard({ streak, healthScore, dayNumber }: StreakCardProps) {
  const scoreColor = getScoreColor(healthScore);

  const handleShare = useCallback(async () => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      const w = 600;
      const h = 400;
      canvas.width = w;
      canvas.height = h;

      // Background gradient
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#1a1a1a');
      grad.addColorStop(1, '#2a2a2a');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(0, 0, w, h, 24);
      ctx.fill();

      // Accent bar at top
      ctx.fillStyle = scoreColor;
      ctx.fillRect(0, 0, w, 4);

      // Title
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px Nunito, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Brain Check', w / 2, 50);

      ctx.fillStyle = '#6b7280';
      ctx.font = '14px Nunito, system-ui, sans-serif';
      ctx.fillText(`Day ${dayNumber} — Dopamine Detox`, w / 2, 75);

      // Streak number
      ctx.fillStyle = scoreColor;
      ctx.font = 'bold 96px Nunito, system-ui, sans-serif';
      ctx.fillText(`${streak}`, w / 2, 200);

      ctx.fillStyle = '#9ca3af';
      ctx.font = 'bold 18px Nunito, system-ui, sans-serif';
      ctx.fillText('DAY STREAK', w / 2, 230);

      // Health bar
      const barW = 280;
      const barH = 10;
      const barX = (w - barW) / 2;
      const barY = 270;

      ctx.fillStyle = '#374151';
      ctx.beginPath();
      ctx.roundRect(barX, barY, barW, barH, 5);
      ctx.fill();

      ctx.fillStyle = scoreColor;
      ctx.beginPath();
      ctx.roundRect(barX, barY, barW * (healthScore / 100), barH, 5);
      ctx.fill();

      ctx.fillStyle = '#6b7280';
      ctx.font = '14px Nunito, system-ui, sans-serif';
      ctx.fillText(`Health Score: ${healthScore}/100`, w / 2, 310);

      // Footer
      ctx.fillStyle = '#4b5563';
      ctx.font = '12px Nunito, system-ui, sans-serif';
      ctx.fillText('braincheck.app', w / 2, 370);

      canvas.toBlob(async (blob) => {
        if (!blob) return;
        if (navigator.share) {
          const file = new File([blob], 'brain-check-streak.png', { type: 'image/png' });
          await navigator.share({
            title: 'Brain Check Streak',
            text: `${streak} day streak! Health: ${healthScore}/100 🧠`,
            files: [file],
          });
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'brain-check-streak.png';
          a.click();
          URL.revokeObjectURL(url);
        }
      }, 'image/png');
    } catch {
      // cancelled
    }
  }, [streak, healthScore, dayNumber, scoreColor]);

  return (
    <div>
      {/* Preview card */}
      <div className="bg-[#1a1a1a] rounded-2xl p-6 text-center overflow-hidden relative">
        <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: scoreColor }} />
        <p className="text-xs font-bold text-[#6b7280] mb-1">Day {dayNumber}</p>
        <div className="text-5xl font-extrabold mb-1" style={{ color: scoreColor }}>{streak}</div>
        <p className="text-xs font-bold text-[#6b7280] uppercase tracking-wider">Day Streak</p>
        <div className="mt-4 mx-auto w-48">
          <div className="w-full h-2 bg-[#374151] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${healthScore}%`, backgroundColor: scoreColor }}
            />
          </div>
          <p className="text-[11px] text-[#6b7280] mt-1.5">Health: {healthScore}/100</p>
        </div>
      </div>
      <button
        onClick={handleShare}
        className="mt-3 w-full py-3 rounded-2xl bg-[#1a1a1a] text-white font-bold text-sm hover:bg-[#2a2a2a] transition-all active:scale-[0.98]"
      >
        Share Image
      </button>
    </div>
  );
}

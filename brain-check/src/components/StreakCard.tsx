import { useRef, useCallback } from 'react';
import BrainCharacter from './BrainCharacter';

interface StreakCardProps {
  streak: number;
  healthScore: number;
  dayNumber: number;
}

export default function StreakCard({ streak, healthScore, dayNumber }: StreakCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleShare = useCallback(async () => {
    if (!cardRef.current) return;

    try {
      // Use canvas to render shareable card
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      const w = 600;
      const h = 400;
      canvas.width = w;
      canvas.height = h;

      // Background
      ctx.fillStyle = '#faf7f2';
      ctx.beginPath();
      ctx.roundRect(0, 0, w, h, 20);
      ctx.fill();

      // Header
      ctx.fillStyle = '#2d2a26';
      ctx.font = 'bold 32px Nunito, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🧠 Brain Check', w / 2, 55);

      // Day
      ctx.fillStyle = '#8a8680';
      ctx.font = '18px Nunito, sans-serif';
      ctx.fillText(`Day ${dayNumber}`, w / 2, 85);

      // Streak
      const scoreColor = healthScore >= 70 ? '#5ecc8b' : healthScore >= 40 ? '#f0c060' : '#e06060';
      ctx.fillStyle = scoreColor;
      ctx.font = 'bold 80px Nunito, sans-serif';
      ctx.fillText(`${streak}`, w / 2, 200);

      ctx.fillStyle = '#2d2a26';
      ctx.font = 'bold 24px Nunito, sans-serif';
      ctx.fillText('day streak', w / 2, 235);

      // Health score
      ctx.font = '20px Nunito, sans-serif';
      ctx.fillStyle = '#8a8680';
      ctx.fillText(`Health Score: ${healthScore}/100`, w / 2, 290);

      // Health bar
      const barW = 300;
      const barH = 12;
      const barX = (w - barW) / 2;
      const barY = 310;

      ctx.fillStyle = '#e8e4de';
      ctx.beginPath();
      ctx.roundRect(barX, barY, barW, barH, 6);
      ctx.fill();

      ctx.fillStyle = scoreColor;
      ctx.beginPath();
      ctx.roundRect(barX, barY, barW * (healthScore / 100), barH, 6);
      ctx.fill();

      // Footer
      ctx.fillStyle = '#b0aaa0';
      ctx.font = '14px Nunito, sans-serif';
      ctx.fillText('Dopamine Detox Tracker', w / 2, 370);

      canvas.toBlob(async (blob) => {
        if (!blob) return;

        if (navigator.share) {
          const file = new File([blob], 'brain-check-streak.png', { type: 'image/png' });
          await navigator.share({
            title: 'Brain Check Streak',
            text: `Day ${streak} streak! Health score: ${healthScore}/100 🧠`,
            files: [file],
          });
        } else {
          // Fallback: download
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'brain-check-streak.png';
          a.click();
          URL.revokeObjectURL(url);
        }
      }, 'image/png');
    } catch {
      // Share cancelled or failed silently
    }
  }, [streak, healthScore, dayNumber]);

  return (
    <div>
      <div
        ref={cardRef}
        className="bg-white rounded-2xl p-6 border border-[#e8e4de] shadow-sm text-center"
      >
        <div className="flex justify-center mb-2">
          <BrainCharacter healthScore={healthScore} size={80} />
        </div>
        <div className="text-4xl font-extrabold text-[#2d2a26]">{streak}</div>
        <div className="text-sm font-semibold text-[#8a8680]">day streak</div>
        <div className="text-xs text-[#b0aaa0] mt-1">Day {dayNumber} · Score {healthScore}/100</div>
      </div>
      <button
        onClick={handleShare}
        className="mt-3 w-full py-3 rounded-2xl bg-[#2d2a26] text-white font-bold text-sm hover:bg-[#3d3a36] transition-colors"
      >
        Share Streak Card
      </button>
    </div>
  );
}

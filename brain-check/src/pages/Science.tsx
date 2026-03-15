import { useMemo } from 'react';
import { loadData, getDayNumber } from '../store';
import { SCIENCE_MILESTONES } from '../constants';

export default function Science() {
  const data = useMemo(loadData, []);
  const currentDay = getDayNumber(data);
  const unlockedCount = SCIENCE_MILESTONES.filter((m) => currentDay >= m.day).length;

  return (
    <div className="px-4 md:px-6 pt-6 md:pt-8 space-y-5">
      <div className="animate-fade-in-up" style={{ opacity: 0 }}>
        <h1 className="text-2xl md:text-3xl font-extrabold text-white mb-1">Science Timeline</h1>
        <p className="text-sm text-[#6b6b80] font-semibold">
          Your brain's recovery — Day {currentDay}
        </p>
      </div>

      <div className="flex items-center gap-2 animate-fade-in-up" style={{ opacity: 0, animationDelay: '80ms' }}>
        <div className="flex-1 h-2 bg-white/[0.06] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#22c55e] rounded-full transition-all duration-500"
            style={{ width: `${(unlockedCount / SCIENCE_MILESTONES.length) * 100}%` }}
          />
        </div>
        <span className="text-xs font-bold text-[#6b6b80]">
          {unlockedCount}/{SCIENCE_MILESTONES.length}
        </span>
      </div>

      <div className="relative animate-fade-in-up" style={{ opacity: 0, animationDelay: '160ms' }}>
        {/* Timeline line */}
        <div className="absolute left-[23px] top-6 bottom-6 w-[2px] bg-white/[0.06]" />

        <div className="space-y-4">
          {SCIENCE_MILESTONES.map((milestone, i) => {
            const unlocked = currentDay >= milestone.day;
            const isNext =
              !unlocked &&
              (i === 0 || currentDay >= SCIENCE_MILESTONES[i - 1].day);
            const daysLeft = milestone.day - currentDay;
            const progress = isNext ? Math.min(((currentDay - (i > 0 ? SCIENCE_MILESTONES[i-1].day : 0)) / (milestone.day - (i > 0 ? SCIENCE_MILESTONES[i-1].day : 0))) * 100, 99) : 0;

            return (
              <div key={milestone.day} className="relative flex gap-4">
                {/* Timeline node */}
                <div
                  className={`relative z-10 w-12 h-12 rounded-2xl flex items-center justify-center text-xl shrink-0 transition-all ${
                    unlocked
                      ? 'bg-[#22c55e] shadow-lg shadow-[#22c55e]/20'
                      : isNext
                      ? 'bg-[#f59e0b] shadow-lg shadow-[#f59e0b]/20'
                      : 'bg-white/[0.06]'
                  }`}
                >
                  {unlocked ? (
                    <span className="text-white text-lg">{milestone.icon}</span>
                  ) : isNext ? (
                    <span className="text-white text-base">⏳</span>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="#6b6b80" stroke="none">
                      <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
                    </svg>
                  )}
                </div>

                {/* Content card */}
                <div
                  className={`flex-1 rounded-2xl p-4 transition-all ${
                    unlocked
                      ? 'card'
                      : isNext
                      ? 'bg-[#f59e0b]/5 border border-[#f59e0b]/20 rounded-2xl'
                      : 'bg-white/[0.02] border border-white/[0.04] rounded-2xl opacity-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold text-[#6b6b80] uppercase">Day {milestone.day}</span>
                    {unlocked && (
                      <span className="text-[10px] font-bold text-[#22c55e] bg-[#22c55e]/10 px-2 py-0.5 rounded-md">
                        UNLOCKED
                      </span>
                    )}
                    {isNext && (
                      <span className="text-[10px] font-bold text-[#f59e0b] bg-[#f59e0b]/10 px-2 py-0.5 rounded-md">
                        {daysLeft}d LEFT
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-[15px] text-white mb-1.5">{milestone.title}</h3>
                  {unlocked ? (
                    <p className="text-[13px] text-[#c8c7d4] leading-relaxed">{milestone.description}</p>
                  ) : isNext ? (
                    <div>
                      <div className="w-full h-1.5 bg-[#f59e0b]/20 rounded-full overflow-hidden mb-2">
                        <div
                          className="h-full bg-[#f59e0b] rounded-full transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <p className="text-[13px] text-[#6b6b80] italic">
                        {daysLeft} more day{daysLeft > 1 ? 's' : ''} to unlock this milestone.
                      </p>
                    </div>
                  ) : (
                    <p className="text-[13px] text-[#6b6b80] italic">Keep going to unlock.</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

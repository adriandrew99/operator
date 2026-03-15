import { useMemo } from 'react';
import { loadData, getDayNumber } from '../store';
import { SCIENCE_MILESTONES } from '../constants';

export default function Science() {
  const data = useMemo(loadData, []);
  const currentDay = getDayNumber(data);

  return (
    <div className="px-4 pt-6 pb-24 max-w-lg mx-auto space-y-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-extrabold text-[#2d2a26]">Science Timeline</h1>
        <p className="text-sm text-[#8a8680] font-semibold mt-1">
          Your brain's recovery journey — Day {currentDay}
        </p>
      </div>

      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-[#e8e4de]" />

        <div className="space-y-4">
          {SCIENCE_MILESTONES.map((milestone, i) => {
            const unlocked = currentDay >= milestone.day;
            const isNext =
              !unlocked &&
              (i === 0 || currentDay >= SCIENCE_MILESTONES[i - 1].day);

            return (
              <div key={milestone.day} className="relative flex gap-4">
                {/* Timeline dot */}
                <div
                  className={`relative z-10 w-12 h-12 rounded-full flex items-center justify-center text-xl shrink-0 border-2 transition-all ${
                    unlocked
                      ? 'bg-[#5ecc8b]/10 border-[#5ecc8b]'
                      : isNext
                      ? 'bg-[#f0c060]/10 border-[#f0c060] animate-pulse'
                      : 'bg-[#e8e4de] border-[#d0ccc6]'
                  }`}
                >
                  {unlocked ? milestone.icon : isNext ? '⏳' : '🔒'}
                </div>

                {/* Content */}
                <div
                  className={`flex-1 rounded-2xl p-4 border shadow-sm transition-all ${
                    unlocked
                      ? 'bg-white border-[#e8e4de]'
                      : 'bg-[#f5f3f0] border-[#e8e4de] opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-[#8a8680]">Day {milestone.day}</span>
                    {unlocked && (
                      <span className="text-[10px] font-bold text-[#5ecc8b] bg-[#5ecc8b]/10 px-2 py-0.5 rounded-full">
                        UNLOCKED
                      </span>
                    )}
                    {isNext && (
                      <span className="text-[10px] font-bold text-[#f0c060] bg-[#f0c060]/10 px-2 py-0.5 rounded-full">
                        {milestone.day - currentDay} DAYS LEFT
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-[15px] text-[#2d2a26] mb-1">{milestone.title}</h3>
                  {unlocked ? (
                    <p className="text-sm text-[#2d2a26] leading-relaxed">
                      {milestone.description}
                    </p>
                  ) : (
                    <p className="text-sm text-[#8a8680] italic">
                      {isNext
                        ? `Keep going! ${milestone.day - currentDay} more day${milestone.day - currentDay > 1 ? 's' : ''} to unlock this milestone.`
                        : 'Complete earlier milestones to reveal this science fact.'}
                    </p>
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

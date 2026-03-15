import { useMemo } from 'react';
import { loadData, getAllDaysSorted } from '../store';
import { RULES } from '../constants';

export default function History() {
  const data = useMemo(loadData, []);
  const allDays = useMemo(() => getAllDaysSorted(data), [data]);

  return (
    <div className="px-4 pt-6 pb-24 max-w-lg mx-auto space-y-5 animate-fade-in">
      <h1 className="text-2xl font-extrabold text-[#2d2a26]">History</h1>

      {allDays.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">📅</p>
          <p className="text-sm text-[#8a8680]">No history yet. Complete your first check-in!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {allDays.map((day) => {
            const rulesHeld = Object.values(day.rules).filter(Boolean).length;
            const allHeld = rulesHeld === RULES.length;
            const scoreColor =
              day.healthScore >= 70 ? '#5ecc8b' : day.healthScore >= 40 ? '#f0c060' : '#e06060';

            return (
              <div
                key={day.date}
                className={`bg-white rounded-2xl p-4 border shadow-sm ${
                  allHeld ? 'border-[#5ecc8b]/40' : 'border-[#e8e4de]'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="text-sm font-bold text-[#2d2a26]">
                      {new Date(day.date).toLocaleDateString('en', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                    {allHeld && <span className="ml-2 text-xs">⭐</span>}
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-extrabold" style={{ color: scoreColor }}>
                      {day.healthScore}
                    </span>
                    <span className="text-xs text-[#8a8680]">/100</span>
                  </div>
                </div>

                {/* Rule dots */}
                <div className="flex gap-2 flex-wrap">
                  {RULES.map((rule) => (
                    <div
                      key={rule.key}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${
                        day.rules[rule.key]
                          ? 'bg-[#5ecc8b]/10 text-[#3da86a]'
                          : 'bg-[#e06060]/10 text-[#c04040]'
                      }`}
                    >
                      <span>{rule.emoji}</span>
                      <span>{day.rules[rule.key] ? '✓' : '✗'}</span>
                    </div>
                  ))}
                </div>

                {day.journal && (
                  <p className="mt-2 text-xs text-[#8a8680] truncate">📝 {day.journal}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { useMemo } from 'react';
import { loadData, getAllDaysSorted } from '../store';
import { RULES } from '../constants';

export default function History() {
  const data = useMemo(loadData, []);
  const allDays = useMemo(() => getAllDaysSorted(data), [data]);

  const perfectDays = allDays.filter((d) => Object.values(d.rules).every(Boolean)).length;

  return (
    <div className="px-4 pt-4 pb-24 max-w-lg mx-auto">
      <h1 className="text-xl font-extrabold text-[#1a1a1a] mb-1">History</h1>
      <p className="text-sm text-[#9ca3af] font-semibold mb-5">
        {allDays.length} day{allDays.length !== 1 ? 's' : ''} logged · {perfectDays} perfect
      </p>

      {allDays.length === 0 ? (
        <div className="card-solid p-12 text-center">
          <p className="text-3xl mb-3">📅</p>
          <p className="text-sm text-[#9ca3af] font-semibold">
            No history yet. Complete your first check-in!
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {allDays.map((day) => {
            const rulesHeld = Object.values(day.rules).filter(Boolean).length;
            const allHeld = rulesHeld === RULES.length;
            const scoreColor =
              day.healthScore >= 70 ? '#22c55e' : day.healthScore >= 40 ? '#f59e0b' : '#ef4444';

            return (
              <div
                key={day.date}
                className={`card-solid p-4 transition-all ${allHeld ? 'ring-1 ring-[#22c55e]/30' : ''}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    {allHeld && <span className="text-sm">⭐</span>}
                    <span className="text-sm font-bold text-[#1a1a1a]">
                      {new Date(day.date + 'T12:00:00').toLocaleDateString('en', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                  <div
                    className="text-sm font-extrabold px-2.5 py-1 rounded-lg"
                    style={{ backgroundColor: `${scoreColor}12`, color: scoreColor }}
                  >
                    {day.healthScore}
                  </div>
                </div>

                {/* Rule pills */}
                <div className="flex gap-1.5 flex-wrap">
                  {RULES.map((rule) => (
                    <div
                      key={rule.key}
                      className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold ${
                        day.rules[rule.key]
                          ? 'bg-[#22c55e]/8 text-[#16a34a]'
                          : 'bg-[#ef4444]/8 text-[#dc2626]'
                      }`}
                    >
                      <span className="text-xs">{rule.emoji}</span>
                      {day.rules[rule.key] ? '✓' : '✗'}
                    </div>
                  ))}
                </div>

                {day.journal && (
                  <p className="mt-2.5 text-xs text-[#9ca3af] leading-relaxed">
                    📝 {day.journal}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { loadData, getLast7Days, getRuleStreak } from '../store';
import { RULES } from '../constants';

export default function Stats() {
  const data = useMemo(loadData, []);
  const last7 = useMemo(() => getLast7Days(data), [data]);

  const chartData = last7.map((log) => {
    const day = new Date(log.date);
    const label = day.toLocaleDateString('en', { weekday: 'short' });
    const rulesHeld = Object.values(log.rules).filter(Boolean).length;
    return {
      day: label,
      score: log.healthScore,
      rulesHeld,
    };
  });

  const ruleStreaks = RULES.map((rule) => ({
    ...rule,
    streak: getRuleStreak(data, rule.key),
  }));

  const longestOverallStreak = ruleStreaks.reduce((max, r) => Math.max(max, r.streak), 0);

  return (
    <div className="px-4 pt-6 pb-24 max-w-lg mx-auto space-y-6 animate-fade-in">
      <h1 className="text-2xl font-extrabold text-[#2d2a26]">Weekly Stats</h1>

      {/* Health Score Over Time */}
      <div className="bg-white rounded-2xl p-5 border border-[#e8e4de] shadow-sm">
        <h2 className="text-sm font-bold text-[#2d2a26] mb-4">Health Score — Last 7 Days</h2>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8e4de" />
            <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#8a8680' }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#8a8680' }} />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: '1px solid #e8e4de',
                fontSize: 13,
                fontFamily: 'Nunito',
              }}
            />
            <Line
              type="monotone"
              dataKey="score"
              stroke="#5ecc8b"
              strokeWidth={2.5}
              dot={{ r: 4, fill: '#5ecc8b' }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Rules Held Per Day */}
      <div className="bg-white rounded-2xl p-5 border border-[#e8e4de] shadow-sm">
        <h2 className="text-sm font-bold text-[#2d2a26] mb-4">Rules Held Per Day</h2>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8e4de" />
            <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#8a8680' }} />
            <YAxis domain={[0, 6]} tick={{ fontSize: 12, fill: '#8a8680' }} />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: '1px solid #e8e4de',
                fontSize: 13,
                fontFamily: 'Nunito',
              }}
            />
            <Bar dataKey="rulesHeld" fill="#5ecc8b" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Rule Streaks */}
      <div className="bg-white rounded-2xl p-5 border border-[#e8e4de] shadow-sm">
        <h2 className="text-sm font-bold text-[#2d2a26] mb-4">Current Streaks Per Rule</h2>
        <div className="space-y-3">
          {ruleStreaks.map((rule) => (
            <div key={rule.key} className="flex items-center gap-3">
              <span className="text-lg w-8">{rule.emoji}</span>
              <span className="flex-1 text-sm font-semibold">{rule.label}</span>
              <div className="flex items-center gap-2">
                <div className="w-24 h-2 bg-[#e8e4de] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#5ecc8b] rounded-full transition-all"
                    style={{
                      width: `${longestOverallStreak > 0 ? (rule.streak / longestOverallStreak) * 100 : 0}%`,
                    }}
                  />
                </div>
                <span className="text-sm font-bold text-[#2d2a26] w-8 text-right">
                  {rule.streak}d
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

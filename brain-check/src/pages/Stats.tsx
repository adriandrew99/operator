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
import { loadData, getLast7Days, getRuleStreak, getCurrentStreak, getDayNumber } from '../store';
import { RULES } from '../constants';

export default function Stats() {
  const data = useMemo(loadData, []);
  const last7 = useMemo(() => getLast7Days(data), [data]);
  const streak = getCurrentStreak(data);
  const dayNumber = getDayNumber(data);

  const chartData = last7.map((log) => {
    const day = new Date(log.date + 'T12:00:00');
    const label = day.toLocaleDateString('en', { weekday: 'short' });
    const rulesHeld = Object.values(log.rules).filter(Boolean).length;
    return { day: label, score: log.healthScore, rulesHeld };
  });

  const ruleStreaks = RULES.map((rule) => ({
    ...rule,
    streak: getRuleStreak(data, rule.key),
  })).sort((a, b) => b.streak - a.streak);

  const bestDay = last7.reduce((best, log) => log.healthScore > best.healthScore ? log : best, last7[0]);
  const avgScore = Math.round(last7.reduce((sum, l) => sum + l.healthScore, 0) / last7.length);

  return (
    <div className="px-4 pt-4 pb-24 max-w-lg mx-auto">
      <h1 className="text-xl font-extrabold text-[#1a1a1a] mb-1">Your Stats</h1>
      <p className="text-sm text-[#9ca3af] font-semibold mb-5">Week overview — Day {dayNumber}</p>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="card-solid p-3.5 text-center">
          <div className="text-2xl font-extrabold text-[#1a1a1a]">{streak}</div>
          <div className="text-[10px] font-bold text-[#9ca3af] uppercase">Streak</div>
        </div>
        <div className="card-solid p-3.5 text-center">
          <div className="text-2xl font-extrabold text-[#22c55e]">{avgScore}</div>
          <div className="text-[10px] font-bold text-[#9ca3af] uppercase">Avg Score</div>
        </div>
        <div className="card-solid p-3.5 text-center">
          <div className="text-2xl font-extrabold text-[#f59e0b]">{bestDay.healthScore}</div>
          <div className="text-[10px] font-bold text-[#9ca3af] uppercase">Best Day</div>
        </div>
      </div>

      {/* Health Score Chart */}
      <div className="card-solid p-5 mb-5">
        <h2 className="text-sm font-bold text-[#1a1a1a] mb-4">Health Score</h2>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0ece6" />
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9ca3af', fontWeight: 600 }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#9ca3af' }} />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: 'none',
                boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                fontSize: 13,
                fontFamily: 'Nunito',
              }}
            />
            <Line
              type="monotone"
              dataKey="score"
              stroke="#22c55e"
              strokeWidth={3}
              dot={{ r: 5, fill: '#22c55e', stroke: '#fff', strokeWidth: 2 }}
              activeDot={{ r: 7 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Rules Held Chart */}
      <div className="card-solid p-5 mb-5">
        <h2 className="text-sm font-bold text-[#1a1a1a] mb-4">Rules Held Per Day</h2>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0ece6" />
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9ca3af', fontWeight: 600 }} />
            <YAxis domain={[0, 6]} tick={{ fontSize: 11, fill: '#9ca3af' }} />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: 'none',
                boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                fontSize: 13,
                fontFamily: 'Nunito',
              }}
            />
            <Bar dataKey="rulesHeld" fill="#22c55e" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Rule Streaks */}
      <div className="card-solid p-5">
        <h2 className="text-sm font-bold text-[#1a1a1a] mb-4">Streaks Per Rule</h2>
        <div className="space-y-4">
          {ruleStreaks.map((rule) => (
            <div key={rule.key} className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#f5f2ed] flex items-center justify-center text-lg shrink-0">
                {rule.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-bold text-[#1a1a1a]">{rule.label}</span>
                  <span className="text-sm font-extrabold text-[#1a1a1a]">{rule.streak}d</span>
                </div>
                <div className="w-full h-2 bg-[#f0ece6] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#22c55e] rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(rule.streak * 3.3, rule.streak > 0 ? 5 : 0)}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

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
    <div className="px-4 md:px-6 pt-6 md:pt-8 space-y-5">
      <div className="animate-fade-in-up" style={{ opacity: 0 }}>
        <h1 className="text-2xl md:text-3xl font-extrabold text-white mb-1">Your Stats</h1>
        <p className="text-sm text-[#6b6b80] font-semibold">Week overview — Day {dayNumber}</p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3 animate-fade-in-up" style={{ opacity: 0, animationDelay: '80ms' }}>
        <div className="card p-3.5 text-center">
          <div className="text-2xl font-extrabold text-white">{streak}</div>
          <div className="text-[10px] font-bold text-[#6b6b80] uppercase">Streak</div>
        </div>
        <div className="card p-3.5 text-center">
          <div className="text-2xl font-extrabold text-[#22c55e]">{avgScore}</div>
          <div className="text-[10px] font-bold text-[#6b6b80] uppercase">Avg Score</div>
        </div>
        <div className="card p-3.5 text-center">
          <div className="text-2xl font-extrabold text-[#f59e0b]">{bestDay.healthScore}</div>
          <div className="text-[10px] font-bold text-[#6b6b80] uppercase">Best Day</div>
        </div>
      </div>

      {/* Health Score Chart */}
      <div className="card p-5 animate-fade-in-up" style={{ opacity: 0, animationDelay: '160ms' }}>
        <h2 className="text-sm font-bold text-[#e0dfe8] mb-4">Health Score</h2>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#6b6b80', fontWeight: 600 }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#6b6b80' }} />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.06)',
                backgroundColor: '#1a1a24',
                boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                fontSize: 13,
                fontFamily: 'Nunito',
                color: '#e0dfe8',
              }}
            />
            <Line
              type="monotone"
              dataKey="score"
              stroke="#22c55e"
              strokeWidth={3}
              dot={{ r: 5, fill: '#22c55e', stroke: '#1a1a24', strokeWidth: 2 }}
              activeDot={{ r: 7 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Rules Held Chart */}
      <div className="card p-5 animate-fade-in-up" style={{ opacity: 0, animationDelay: '240ms' }}>
        <h2 className="text-sm font-bold text-[#e0dfe8] mb-4">Rules Held Per Day</h2>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#6b6b80', fontWeight: 600 }} />
            <YAxis domain={[0, 6]} tick={{ fontSize: 11, fill: '#6b6b80' }} />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.06)',
                backgroundColor: '#1a1a24',
                boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                fontSize: 13,
                fontFamily: 'Nunito',
                color: '#e0dfe8',
              }}
            />
            <Bar dataKey="rulesHeld" fill="#22c55e" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Rule Streaks */}
      <div className="card p-5 animate-fade-in-up" style={{ opacity: 0, animationDelay: '320ms' }}>
        <h2 className="text-sm font-bold text-[#e0dfe8] mb-4">Streaks Per Rule</h2>
        <div className="space-y-4">
          {ruleStreaks.map((rule) => (
            <div key={rule.key} className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center text-lg shrink-0">
                {rule.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-bold text-[#e0dfe8]">{rule.label}</span>
                  <span className="text-sm font-extrabold text-white">{rule.streak}d</span>
                </div>
                <div className="w-full h-2 bg-white/[0.06] rounded-full overflow-hidden">
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

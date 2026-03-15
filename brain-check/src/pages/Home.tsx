import { useState, useEffect, useCallback } from 'react';
import BrainCharacter from '../components/BrainCharacter';
import HealthBar from '../components/HealthBar';
import RuleToggle from '../components/RuleToggle';
import BrainIntelCard from '../components/BrainIntelCard';
import AiMessage from '../components/AiMessage';
import StreakCard from '../components/StreakCard';
import { RULES } from '../constants';
import {
  loadData,
  getTodayLog,
  saveTodayLog,
  calculateHealthScore,
  getCurrentStreak,
  getDayNumber,
} from '../store';
import type { RuleKey } from '../types';

export default function Home() {
  const [data, setData] = useState(loadData);
  const [todayLog, setTodayLog] = useState(() => getTodayLog(data));
  const [showShareCard, setShowShareCard] = useState(false);

  const streak = getCurrentStreak(data);
  const dayNumber = getDayNumber(data);

  const handleToggle = useCallback(
    (key: RuleKey) => {
      const updated = {
        ...todayLog,
        rules: { ...todayLog.rules, [key]: !todayLog.rules[key] },
      };
      updated.healthScore = calculateHealthScore(updated.rules, streak);
      setTodayLog(updated);
      const newData = saveTodayLog(data, updated);
      setData(newData);
    },
    [todayLog, data, streak]
  );

  // Recalculate health score when streak changes
  useEffect(() => {
    const score = calculateHealthScore(todayLog.rules, streak);
    if (score !== todayLog.healthScore) {
      const updated = { ...todayLog, healthScore: score };
      setTodayLog(updated);
      saveTodayLog(data, updated);
    }
  }, [streak]);

  const rulesHeld = Object.values(todayLog.rules).filter(Boolean).length;

  return (
    <div className="px-4 pt-6 pb-24 max-w-lg mx-auto space-y-5 animate-fade-in">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-extrabold text-[#2d2a26]">Brain Check</h1>
        <p className="text-sm text-[#8a8680] font-semibold">Day {dayNumber} · Dopamine Detox</p>
      </div>

      {/* Brain Character */}
      <div className="flex justify-center">
        <BrainCharacter healthScore={todayLog.healthScore} size={180} />
      </div>

      {/* Health Score */}
      <HealthBar score={todayLog.healthScore} />

      {/* Streak */}
      <div className="flex items-center justify-between bg-white rounded-2xl px-5 py-4 border border-[#e8e4de] shadow-sm">
        <div>
          <div className="text-sm text-[#8a8680] font-semibold">Current Streak</div>
          <div className="text-3xl font-extrabold text-[#2d2a26]">
            {streak} <span className="text-base font-bold text-[#8a8680]">days</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm text-[#8a8680] font-semibold">Rules Held</div>
          <div className="text-3xl font-extrabold text-[#5ecc8b]">
            {rulesHeld}<span className="text-base font-bold text-[#8a8680]">/{RULES.length}</span>
          </div>
        </div>
      </div>

      {/* Daily Check-in */}
      <div>
        <h2 className="text-lg font-bold text-[#2d2a26] mb-3">Today's Check-in</h2>
        <div className="space-y-2.5">
          {RULES.map((rule) => (
            <RuleToggle
              key={rule.key}
              rule={rule}
              checked={todayLog.rules[rule.key]}
              onToggle={() => handleToggle(rule.key)}
            />
          ))}
        </div>
      </div>

      {/* Brain Intel */}
      <BrainIntelCard dayNumber={dayNumber} />

      {/* AI Coach */}
      <AiMessage data={data} todayLog={todayLog} streak={streak} />

      {/* Share Card Toggle */}
      <button
        onClick={() => setShowShareCard(!showShareCard)}
        className="w-full py-3 rounded-2xl bg-gradient-to-r from-[#5ecc8b] to-[#4ab87a] text-white font-bold text-sm shadow-sm hover:shadow-md transition-shadow"
      >
        {showShareCard ? 'Hide' : '📸 Share'} Streak Card
      </button>

      {showShareCard && (
        <div className="animate-slide-up">
          <StreakCard streak={streak} healthScore={todayLog.healthScore} dayNumber={dayNumber} />
        </div>
      )}
    </div>
  );
}

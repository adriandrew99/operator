import { useState, useCallback } from 'react';
import ProgressRing from '../components/ProgressRing';
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
  getScoreColor,
  getScoreLabel,
} from '../store';
import type { RuleKey } from '../types';

export default function Home() {
  const [data, setData] = useState(loadData);
  const [todayLog, setTodayLog] = useState(() => getTodayLog(data));
  const [showShareCard, setShowShareCard] = useState(false);
  const [justToggled, setJustToggled] = useState(false);

  const streak = getCurrentStreak(data);
  const dayNumber = getDayNumber(data);
  const rulesHeld = Object.values(todayLog.rules).filter(Boolean).length;
  const allHeld = rulesHeld === RULES.length;
  const scoreColor = getScoreColor(todayLog.healthScore);

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
      setJustToggled(true);
      setTimeout(() => setJustToggled(false), 500);
    },
    [todayLog, data, streak]
  );

  const handleAiMessageSaved = useCallback(
    (msg: string) => {
      const updated = { ...todayLog, aiMessage: msg };
      setTodayLog(updated);
      saveTodayLog(data, updated);
    },
    [todayLog, data]
  );

  // Motivational greeting based on time of day
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="px-4 pt-4 pb-24 max-w-lg mx-auto">
      {/* Greeting */}
      <div className="mb-6 animate-fade-in-up" style={{ opacity: 0, animationDelay: '0ms' }}>
        <h1 className="text-xl font-extrabold text-[#1a1a1a]">{greeting}</h1>
        <p className="text-sm text-[#9ca3af] font-semibold">
          Day {dayNumber} of your dopamine detox
        </p>
      </div>

      {/* Main Progress Ring + Stats */}
      <div className="card p-6 mb-5 animate-fade-in-up" style={{ opacity: 0, animationDelay: '100ms' }}>
        <div className="flex justify-center mb-4">
          <div className={justToggled ? 'animate-score-up' : ''}>
            <ProgressRing
              score={todayLog.healthScore}
              rulesHeld={rulesHeld}
              totalRules={RULES.length}
            />
          </div>
        </div>

        {/* Status label */}
        <div className="text-center mb-5">
          <div
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider"
            style={{
              backgroundColor: `${scoreColor}15`,
              color: scoreColor,
            }}
          >
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: scoreColor }} />
            {getScoreLabel(todayLog.healthScore)}
          </div>
        </div>

        {/* Streak + Rules Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 bg-[#faf8f5] rounded-xl">
            <div className="flex justify-center mb-1">
              {streak > 0 ? (
                <span className="text-lg animate-streak-fire">🔥</span>
              ) : (
                <span className="text-lg">💤</span>
              )}
            </div>
            <div className="text-xl font-extrabold text-[#1a1a1a]">{streak}</div>
            <div className="text-[10px] font-bold text-[#9ca3af] uppercase">Streak</div>
          </div>
          <div className="text-center p-3 bg-[#faf8f5] rounded-xl">
            <div className="flex justify-center mb-1">
              <span className="text-lg">{allHeld ? '⭐' : '📋'}</span>
            </div>
            <div className="text-xl font-extrabold" style={{ color: rulesHeld > 0 ? '#22c55e' : '#9ca3af' }}>
              {rulesHeld}/{RULES.length}
            </div>
            <div className="text-[10px] font-bold text-[#9ca3af] uppercase">Today</div>
          </div>
          <div className="text-center p-3 bg-[#faf8f5] rounded-xl">
            <div className="flex justify-center mb-1">
              <span className="text-lg">📅</span>
            </div>
            <div className="text-xl font-extrabold text-[#1a1a1a]">{dayNumber}</div>
            <div className="text-[10px] font-bold text-[#9ca3af] uppercase">Day</div>
          </div>
        </div>

        {/* All held celebration */}
        {allHeld && (
          <div className="mt-4 p-3 bg-gradient-to-r from-[#22c55e]/10 to-[#16a34a]/10 rounded-xl text-center animate-fade-in">
            <span className="text-sm font-bold text-[#22c55e]">
              Perfect day! All rules locked in 💪
            </span>
          </div>
        )}
      </div>

      {/* Daily Check-in */}
      <div className="mb-5 animate-fade-in-up" style={{ opacity: 0, animationDelay: '200ms' }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-extrabold text-[#1a1a1a]">Today's Check-in</h2>
          <span className="text-xs font-bold text-[#9ca3af]">
            {rulesHeld === 0 ? 'Tap to check in' : `${rulesHeld} of ${RULES.length} done`}
          </span>
        </div>
        <div className="space-y-2.5">
          {RULES.map((rule, i) => (
            <RuleToggle
              key={rule.key}
              rule={rule}
              checked={todayLog.rules[rule.key]}
              onToggle={() => handleToggle(rule.key)}
              index={i}
            />
          ))}
        </div>
      </div>

      {/* Brain Intel */}
      <div className="mb-5 animate-fade-in-up" style={{ opacity: 0, animationDelay: '300ms' }}>
        <BrainIntelCard dayNumber={dayNumber} />
      </div>

      {/* AI Coach */}
      <div className="mb-5 animate-fade-in-up" style={{ opacity: 0, animationDelay: '400ms' }}>
        <AiMessage data={data} todayLog={todayLog} streak={streak} onMessageSaved={handleAiMessageSaved} />
      </div>

      {/* Share Card */}
      <div className="animate-fade-in-up" style={{ opacity: 0, animationDelay: '500ms' }}>
        <button
          onClick={() => setShowShareCard(!showShareCard)}
          className="w-full py-3.5 rounded-2xl bg-[#1a1a1a] text-white font-bold text-sm hover:bg-[#2a2a2a] transition-all active:scale-[0.98]"
        >
          {showShareCard ? 'Hide Streak Card' : '📸 Share Your Streak'}
        </button>

        {showShareCard && (
          <div className="mt-4 animate-slide-up">
            <StreakCard streak={streak} healthScore={todayLog.healthScore} dayNumber={dayNumber} />
          </div>
        )}
      </div>
    </div>
  );
}

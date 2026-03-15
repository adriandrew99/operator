import { useState, useCallback } from 'react';
import ProgressRing from '../components/ProgressRing';
import RuleToggle from '../components/RuleToggle';
import BrainIntelCard from '../components/BrainIntelCard';
import AiMessage from '../components/AiMessage';
import StreakCard from '../components/StreakCard';
import { RULES } from '../constants';
import {
  loadData, getTodayLog, saveTodayLog, calculateHealthScore,
  getCurrentStreak, getDayNumber, getScoreColor, getScoreLabel,
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

  const handleToggle = useCallback((key: RuleKey) => {
    const updated = { ...todayLog, rules: { ...todayLog.rules, [key]: !todayLog.rules[key] } };
    updated.healthScore = calculateHealthScore(updated.rules, streak);
    setTodayLog(updated);
    setData(saveTodayLog(data, updated));
    setJustToggled(true);
    setTimeout(() => setJustToggled(false), 400);
  }, [todayLog, data, streak]);

  const handleAiMessageSaved = useCallback((msg: string) => {
    const updated = { ...todayLog, aiMessage: msg };
    setTodayLog(updated);
    saveTodayLog(data, updated);
  }, [todayLog, data]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="px-4 md:px-6 pt-6 md:pt-8 space-y-5">
      {/* Header */}
      <div className="animate-fade-in-up" style={{ opacity: 0 }}>
        <h1 className="text-2xl md:text-3xl font-extrabold text-white">{greeting}</h1>
        <p className="text-sm text-[#6b6b80] font-semibold mt-1">
          Day {dayNumber} of your detox
        </p>
      </div>

      {/* Progress + Stats Row */}
      <div className="md:grid md:grid-cols-2 md:gap-5">
        {/* Progress Ring Card */}
        <div className="card p-6 animate-fade-in-up mb-5 md:mb-0" style={{ opacity: 0, animationDelay: '80ms' }}>
          <div className={`flex justify-center ${justToggled ? 'animate-score-up' : ''}`}>
            <ProgressRing score={todayLog.healthScore} rulesHeld={rulesHeld} totalRules={RULES.length} />
          </div>
          <div className="text-center mt-3">
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider"
              style={{ backgroundColor: `${scoreColor}15`, color: scoreColor }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: scoreColor }} />
              {getScoreLabel(todayLog.healthScore)}
            </span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mb-5 md:mb-0 animate-fade-in-up" style={{ opacity: 0, animationDelay: '160ms' }}>
          <div className="card p-4 text-center">
            <div className="text-2xl mb-0.5">{streak > 0 ? '🔥' : '💤'}</div>
            <div className="text-2xl font-extrabold text-white">{streak}</div>
            <div className="text-[10px] font-bold text-[#6b6b80] uppercase tracking-wider">Streak</div>
          </div>
          <div className="card p-4 text-center">
            <div className="text-2xl mb-0.5">{allHeld ? '⭐' : '📋'}</div>
            <div className="text-2xl font-extrabold" style={{ color: rulesHeld > 0 ? '#22c55e' : '#6b6b80' }}>
              {rulesHeld}<span className="text-sm text-[#6b6b80]">/{RULES.length}</span>
            </div>
            <div className="text-[10px] font-bold text-[#6b6b80] uppercase tracking-wider">Today</div>
          </div>
          <div className="card p-4 text-center col-span-2">
            <div className="flex items-center justify-center gap-3">
              <div>
                <div className="text-[10px] font-bold text-[#6b6b80] uppercase tracking-wider mb-1">Day</div>
                <div className="text-xl font-extrabold text-white">{dayNumber}</div>
              </div>
              <div className="w-px h-8 bg-white/[0.06]" />
              <div>
                <div className="text-[10px] font-bold text-[#6b6b80] uppercase tracking-wider mb-1">Score</div>
                <div className="text-xl font-extrabold" style={{ color: scoreColor }}>{todayLog.healthScore}</div>
              </div>
              <div className="w-px h-8 bg-white/[0.06]" />
              <div>
                <div className="text-[10px] font-bold text-[#6b6b80] uppercase tracking-wider mb-1">Best</div>
                <div className="text-xl font-extrabold text-violet-400">{Math.max(todayLog.healthScore, ...Object.values(data.logs).map(l => l.healthScore || 0))}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Perfect Day */}
      {allHeld && (
        <div className="card-success p-4 text-center animate-fade-in">
          <span className="text-sm font-bold text-[#22c55e]">Perfect day — all rules locked in 💪</span>
        </div>
      )}

      {/* Check-in */}
      <div className="animate-fade-in-up" style={{ opacity: 0, animationDelay: '240ms' }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-extrabold text-white">Daily Check-in</h2>
          <span className="text-xs font-bold text-[#6b6b80]">
            {rulesHeld === 0 ? 'Tap to check in' : `${rulesHeld}/${RULES.length}`}
          </span>
        </div>
        <div className="space-y-2">
          {RULES.map((rule, i) => (
            <RuleToggle key={rule.key} rule={rule} checked={todayLog.rules[rule.key]} onToggle={() => handleToggle(rule.key)} index={i} />
          ))}
        </div>
      </div>

      {/* AI Coach */}
      <div className="animate-fade-in-up" style={{ opacity: 0, animationDelay: '320ms' }}>
        <AiMessage data={data} todayLog={todayLog} streak={streak} onMessageSaved={handleAiMessageSaved} />
      </div>

      {/* Brain Intel */}
      <div className="animate-fade-in-up" style={{ opacity: 0, animationDelay: '400ms' }}>
        <BrainIntelCard dayNumber={dayNumber} />
      </div>

      {/* Share */}
      <div className="animate-fade-in-up" style={{ opacity: 0, animationDelay: '480ms' }}>
        <button
          onClick={() => setShowShareCard(!showShareCard)}
          className="w-full py-3.5 rounded-2xl bg-white/[0.06] border border-white/[0.06] text-[#a0a0b8] font-bold text-sm hover:bg-white/[0.08] transition-all active:scale-[0.98]"
        >
          {showShareCard ? 'Hide' : '📸 Share Your Streak'}
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

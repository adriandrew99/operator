import { useState } from 'react';
import { loadData, getTodayLog, saveTodayLog, getToday, getAllDaysSorted } from '../store';

export default function Journal() {
  const [data, setData] = useState(loadData);
  const [todayLog, setTodayLog] = useState(() => getTodayLog(data));
  const [journalText, setJournalText] = useState(todayLog.journal);
  const [saved, setSaved] = useState(false);

  const allDays = getAllDaysSorted(data).filter((d) => d.journal.trim());
  const today = getToday();

  const handleSave = () => {
    const updated = { ...todayLog, journal: journalText };
    setTodayLog(updated);
    const newData = saveTodayLog(data, updated);
    setData(newData);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="px-4 md:px-6 pt-6 md:pt-8 space-y-5">
      <div className="animate-fade-in-up" style={{ opacity: 0 }}>
        <h1 className="text-2xl md:text-3xl font-extrabold text-white mb-1">Journal</h1>
        <p className="text-sm text-[#6b6b80] font-semibold">Reflect on your journey</p>
      </div>

      {/* Today's Entry */}
      <div className="card p-5 animate-fade-in-up" style={{ opacity: 0, animationDelay: '80ms' }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
              <span className="text-white text-sm">📝</span>
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#e0dfe8] leading-tight">Today</h2>
              <span className="text-[10px] text-[#6b6b80] font-semibold">
                {new Date(today + 'T12:00:00').toLocaleDateString('en', { weekday: 'long', month: 'short', day: 'numeric' })}
              </span>
            </div>
          </div>
          {saved && (
            <span className="text-xs font-bold text-[#22c55e] bg-[#22c55e]/10 px-2.5 py-1 rounded-lg animate-fade-in">
              Saved
            </span>
          )}
        </div>
        <textarea
          value={journalText}
          onChange={(e) => setJournalText(e.target.value)}
          placeholder="What's on your mind? What triggered you today? What went well?"
          className="w-full h-36 p-3.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white leading-relaxed resize-none focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 transition-all placeholder:text-[#6b6b80]"
        />
        <button
          onClick={handleSave}
          disabled={!journalText.trim()}
          className="mt-3 w-full py-3 rounded-xl bg-violet-600 text-white font-bold text-sm hover:bg-violet-500 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Save Entry
        </button>
      </div>

      {/* Past Entries */}
      <div className="animate-fade-in-up" style={{ opacity: 0, animationDelay: '160ms' }}>
        <h3 className="text-sm font-bold text-[#e0dfe8] mb-3">
          Past Entries <span className="text-[#6b6b80]">({allDays.length})</span>
        </h3>
        {allDays.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-2xl mb-2">📖</p>
            <p className="text-sm text-[#6b6b80] font-semibold">No entries yet. Start writing today!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {allDays.map((day) => {
              const scoreColor = day.healthScore >= 70 ? '#22c55e' : day.healthScore >= 40 ? '#f59e0b' : '#ef4444';
              return (
                <div key={day.date} className="card p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-[#6b6b80]">
                      {new Date(day.date + 'T12:00:00').toLocaleDateString('en', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-md"
                      style={{ backgroundColor: `${scoreColor}15`, color: scoreColor }}
                    >
                      Score: {day.healthScore}
                    </span>
                  </div>
                  <p className="text-sm text-[#c8c7d4] leading-relaxed whitespace-pre-wrap">
                    {day.journal}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

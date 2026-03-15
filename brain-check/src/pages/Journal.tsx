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
    <div className="px-4 pt-4 pb-24 max-w-lg mx-auto">
      <h1 className="text-xl font-extrabold text-[#1a1a1a] mb-1">Journal</h1>
      <p className="text-sm text-[#9ca3af] font-semibold mb-5">Reflect on your journey</p>

      {/* Today's Entry */}
      <div className="card-solid p-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
              <span className="text-white text-sm">📝</span>
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#1a1a1a] leading-tight">Today</h2>
              <span className="text-[10px] text-[#9ca3af] font-semibold">
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
          className="w-full h-36 p-3.5 rounded-xl bg-[#faf8f5] border border-[#f0ece6] text-sm leading-relaxed resize-none focus:outline-none focus:border-[#22c55e] focus:ring-2 focus:ring-[#22c55e]/10 transition-all"
        />
        <button
          onClick={handleSave}
          disabled={!journalText.trim()}
          className="mt-3 w-full py-3 rounded-xl bg-[#1a1a1a] text-white font-bold text-sm hover:bg-[#2a2a2a] transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Save Entry
        </button>
      </div>

      {/* Past Entries */}
      <div>
        <h3 className="text-sm font-bold text-[#1a1a1a] mb-3">
          Past Entries <span className="text-[#9ca3af]">({allDays.length})</span>
        </h3>
        {allDays.length === 0 ? (
          <div className="card-solid p-8 text-center">
            <p className="text-2xl mb-2">📖</p>
            <p className="text-sm text-[#9ca3af] font-semibold">No entries yet. Start writing today!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {allDays.map((day) => {
              const scoreColor = day.healthScore >= 70 ? '#22c55e' : day.healthScore >= 40 ? '#f59e0b' : '#ef4444';
              return (
                <div key={day.date} className="card-solid p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-[#9ca3af]">
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
                  <p className="text-sm text-[#1a1a1a] leading-relaxed whitespace-pre-wrap">
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

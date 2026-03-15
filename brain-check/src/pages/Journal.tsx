import { useState } from 'react';
import { loadData, getTodayLog, saveTodayLog, getToday, getAllDaysSorted } from '../store';

export default function Journal() {
  const [data, setData] = useState(loadData);
  const [todayLog, setTodayLog] = useState(() => getTodayLog(data));
  const [journalText, setJournalText] = useState(todayLog.journal);
  const [saved, setSaved] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const allDays = getAllDaysSorted(data).filter((d) => d.journal.trim());

  const handleSave = () => {
    const updated = { ...todayLog, journal: journalText };
    setTodayLog(updated);
    const newData = saveTodayLog(data, updated);
    setData(newData);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const today = getToday();

  return (
    <div className="px-4 pt-6 pb-24 max-w-lg mx-auto space-y-5 animate-fade-in">
      <h1 className="text-2xl font-extrabold text-[#2d2a26]">Journal</h1>

      {/* Today's Entry */}
      <div className="bg-white rounded-2xl p-5 border border-[#e8e4de] shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-[#2d2a26]">
            📝 Today — {new Date(today).toLocaleDateString('en', { weekday: 'long', month: 'short', day: 'numeric' })}
          </h2>
          {saved && (
            <span className="text-xs font-semibold text-[#5ecc8b] animate-fade-in">Saved ✓</span>
          )}
        </div>
        <textarea
          value={journalText}
          onChange={(e) => setJournalText(e.target.value)}
          placeholder="How are you feeling today? What's on your mind? What triggered you?"
          className="w-full h-40 p-3 rounded-xl bg-[#faf7f2] border border-[#e8e4de] text-sm leading-relaxed resize-none focus:outline-none focus:border-[#5ecc8b] transition-colors"
        />
        <button
          onClick={handleSave}
          className="mt-3 w-full py-3 rounded-2xl bg-[#2d2a26] text-white font-bold text-sm hover:bg-[#3d3a36] transition-colors"
        >
          Save Entry
        </button>
      </div>

      {/* History Toggle */}
      <button
        onClick={() => setShowHistory(!showHistory)}
        className="w-full py-3 rounded-2xl bg-white border border-[#e8e4de] text-[#2d2a26] font-bold text-sm shadow-sm"
      >
        {showHistory ? 'Hide' : 'Show'} Past Entries ({allDays.length})
      </button>

      {/* Journal History */}
      {showHistory && (
        <div className="space-y-3 animate-slide-up">
          {allDays.length === 0 ? (
            <p className="text-sm text-[#8a8680] text-center py-8">
              No journal entries yet. Start writing today!
            </p>
          ) : (
            allDays.map((day) => (
              <div
                key={day.date}
                className="bg-white rounded-2xl p-4 border border-[#e8e4de] shadow-sm"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-[#8a8680]">
                    {new Date(day.date).toLocaleDateString('en', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                  <span className="text-xs font-semibold" style={{
                    color: day.healthScore >= 70 ? '#5ecc8b' : day.healthScore >= 40 ? '#f0c060' : '#e06060',
                  }}>
                    Score: {day.healthScore}
                  </span>
                </div>
                <p className="text-sm text-[#2d2a26] leading-relaxed whitespace-pre-wrap">
                  {day.journal}
                </p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

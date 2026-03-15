import { useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import Home from './pages/Home';
import Stats from './pages/Stats';
import Journal from './pages/Journal';
import Science from './pages/Science';
import History from './pages/History';
import Settings from './components/Settings';

const tabs = [
  { to: '/', label: 'Home', icon: 'M12 3l-8 9h5v9h6v-9h5z', filled: true },
  { to: '/stats', label: 'Stats', icon: 'M4 20h4V10H4v10zm6 0h4V4h-4v16zm6 0h4v-8h-4v8z', filled: true },
  { to: '/journal', label: 'Journal', icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4zM6 20V4h5v7h7v9H6z', filled: false },
  { to: '/science', label: 'Science', icon: 'M12 2a7 7 0 017 7c0 2.86-1.72 5.32-4.18 6.4L15 22H9l.18-6.6A7.002 7.002 0 0112 2zm0 2a5 5 0 00-3.13 8.9l.43.34-.17 4.76h5.74l-.17-4.76.43-.35A5 5 0 0012 4z', filled: false },
];

export default function App() {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <BrowserRouter>
      <div className="min-h-full flex flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-40 bg-[#faf8f5]/80 backdrop-blur-xl">
          <div className="max-w-lg mx-auto flex items-center justify-between px-4 h-14">
            <NavLink
              to="/history"
              className="w-9 h-9 rounded-xl bg-white/80 border border-[#f0ece6] flex items-center justify-center hover:bg-white transition-all"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="3" y1="10" x2="21" y2="10" />
                <line x1="10" y1="4" x2="10" y2="10" />
              </svg>
            </NavLink>
            <div className="flex items-center gap-2">
              <span className="text-base font-extrabold text-[#1a1a1a] tracking-tight">Brain Check</span>
            </div>
            <button
              onClick={() => setShowSettings(true)}
              className="w-9 h-9 rounded-xl bg-white/80 border border-[#f0ece6] flex items-center justify-center hover:bg-white transition-all"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.73 12.73l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
            </button>
          </div>
        </header>

        {/* Pages */}
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="/journal" element={<Journal />} />
            <Route path="/science" element={<Science />} />
            <Route path="/history" element={<History />} />
          </Routes>
        </main>

        {/* Bottom Navigation */}
        <nav className="fixed bottom-0 left-0 right-0 z-50 pb-[env(safe-area-inset-bottom)]">
          <div className="max-w-lg mx-auto px-4 pb-2">
            <div className="bg-white/90 backdrop-blur-xl border border-[#f0ece6] rounded-2xl shadow-lg shadow-black/5 flex justify-around items-center h-16 px-2">
              {tabs.map((tab) => (
                <NavLink
                  key={tab.to}
                  to={tab.to}
                  end={tab.to === '/'}
                  className={({ isActive }) =>
                    `flex flex-col items-center gap-1 px-5 py-2 rounded-xl transition-all ${
                      isActive
                        ? 'text-[#1a1a1a]'
                        : 'text-[#c0bbb4] hover:text-[#9ca3af]'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill={isActive ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d={tab.icon} />
                      </svg>
                      <span className={`text-[10px] font-bold ${isActive ? 'text-[#1a1a1a]' : ''}`}>{tab.label}</span>
                      {isActive && (
                        <div className="w-1 h-1 rounded-full bg-[#22c55e] -mt-0.5" />
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        </nav>

        {showSettings && <Settings onClose={() => setShowSettings(false)} />}
      </div>
    </BrowserRouter>
  );
}

import { useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import Home from './pages/Home';
import Stats from './pages/Stats';
import Journal from './pages/Journal';
import Science from './pages/Science';
import History from './pages/History';
import Settings from './components/Settings';

const tabs = [
  { to: '/', label: 'Home', icon: '🧠' },
  { to: '/stats', label: 'Stats', icon: '📊' },
  { to: '/journal', label: 'Journal', icon: '📝' },
  { to: '/science', label: 'Science', icon: '🔬' },
];

export default function App() {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <BrowserRouter>
      <div className="min-h-full bg-[#faf7f2] flex flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-40 bg-[#faf7f2]/90 backdrop-blur-lg border-b border-[#e8e4de]">
          <div className="max-w-lg mx-auto flex items-center justify-between px-4 h-12">
            <NavLink to="/history" className="text-sm font-bold text-[#8a8680] hover:text-[#2d2a26]">
              📅 History
            </NavLink>
            <span className="text-sm font-extrabold text-[#2d2a26]">Brain Check</span>
            <button
              onClick={() => setShowSettings(true)}
              className="text-sm font-bold text-[#8a8680] hover:text-[#2d2a26]"
            >
              ⚙️
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
        <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-[#e8e4de] z-50 pb-[env(safe-area-inset-bottom)]">
          <div className="flex justify-around items-center max-w-lg mx-auto h-16">
            {tabs.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.to === '/'}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl transition-all ${
                    isActive
                      ? 'text-[#2d2a26] scale-105'
                      : 'text-[#8a8680] hover:text-[#2d2a26]'
                  }`
                }
              >
                <span className="text-xl">{tab.icon}</span>
                <span className="text-[11px] font-semibold">{tab.label}</span>
              </NavLink>
            ))}
          </div>
        </nav>

        {/* Settings Modal */}
        {showSettings && <Settings onClose={() => setShowSettings(false)} />}
      </div>
    </BrowserRouter>
  );
}

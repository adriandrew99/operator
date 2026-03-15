import { useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import Home from './pages/Home';
import Stats from './pages/Stats';
import Journal from './pages/Journal';
import Science from './pages/Science';
import History from './pages/History';
import Settings from './components/Settings';

const navItems = [
  { to: '/', label: 'Today', icon: '🏠' },
  { to: '/stats', label: 'Progress', icon: '📊' },
  { to: '/journal', label: 'Journal', icon: '📝' },
  { to: '/science', label: 'Science', icon: '🧬' },
  { to: '/history', label: 'History', icon: '📅' },
];

export default function App() {
  const [showSettings, setShowSettings] = useState(false);

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${
      isActive
        ? 'bg-violet-500/10 text-violet-400'
        : 'text-[#6b6b80] hover:text-[#a0a0b8] hover:bg-white/[0.03]'
    }`;

  return (
    <BrowserRouter>
      <div className="app-shell">
        {/* Desktop Sidebar */}
        <aside className="app-sidebar flex-col bg-[#13131a] border-r border-white/[0.06] p-5 sticky top-0 h-screen">
          <div className="mb-8">
            <h1 className="text-lg font-extrabold text-white tracking-tight">Brain Check</h1>
            <p className="text-[11px] font-semibold text-[#6b6b80] mt-0.5">Dopamine Detox Tracker</p>
          </div>

          <nav className="flex-1 space-y-1">
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === '/'} className={navLinkClass}>
                <span className="text-lg w-6 text-center">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm text-[#6b6b80] hover:text-[#a0a0b8] hover:bg-white/[0.03] transition-all w-full mt-4"
          >
            <span className="text-lg w-6 text-center">⚙️</span>
            Settings
          </button>
        </aside>

        {/* Main Content */}
        <main className="app-main pb-24 md:pb-8">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="/journal" element={<Journal />} />
            <Route path="/science" element={<Science />} />
            <Route path="/history" element={<History />} />
          </Routes>
        </main>

        {/* Mobile Bottom Nav */}
        <nav className="app-bottom-nav fixed bottom-0 left-0 right-0 z-50 pb-[env(safe-area-inset-bottom)]">
          <div className="mx-3 mb-2">
            <div className="bg-[#1a1a24]/95 backdrop-blur-xl border border-white/[0.06] rounded-2xl flex justify-around items-center h-16 px-1">
              {navItems.slice(0, 4).map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl transition-all ${
                      isActive ? 'text-violet-400' : 'text-[#6b6b80]'
                    }`
                  }
                >
                  <span className="text-lg">{item.icon}</span>
                  <span className="text-[10px] font-bold">{item.label}</span>
                </NavLink>
              ))}
              <button
                onClick={() => setShowSettings(true)}
                className="flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl text-[#6b6b80]"
              >
                <span className="text-lg">⚙️</span>
                <span className="text-[10px] font-bold">More</span>
              </button>
            </div>
          </div>
        </nav>

        {showSettings && <Settings onClose={() => setShowSettings(false)} />}
      </div>
    </BrowserRouter>
  );
}

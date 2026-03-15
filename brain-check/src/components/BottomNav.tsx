import { NavLink } from 'react-router-dom';

const tabs = [
  { to: '/', label: 'Home', icon: '🧠' },
  { to: '/stats', label: 'Stats', icon: '📊' },
  { to: '/journal', label: 'Journal', icon: '📝' },
  { to: '/science', label: 'Science', icon: '🔬' },
];

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-[#e8e4de] z-50 pb-[env(safe-area-inset-bottom)]">
      <div className="flex justify-around items-center max-w-lg mx-auto h-16">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
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
  );
}

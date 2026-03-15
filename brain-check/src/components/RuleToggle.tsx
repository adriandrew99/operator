import type { RuleInfo } from '../types';

interface RuleToggleProps {
  rule: RuleInfo;
  checked: boolean;
  onToggle: () => void;
  index: number;
}

export default function RuleToggle({ rule, checked, onToggle, index }: RuleToggleProps) {
  return (
    <button
      onClick={onToggle}
      className="animate-fade-in-up"
      style={{ animationDelay: `${index * 60}ms`, opacity: 0 }}
    >
      <div
        className={`flex items-center gap-3.5 w-full px-4 py-4 rounded-2xl transition-all duration-300 ${
          checked
            ? 'bg-gradient-to-r from-[#22c55e]/10 to-[#22c55e]/5 shadow-md shadow-[#22c55e]/10'
            : 'card-solid hover:shadow-md'
        }`}
      >
        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl transition-all duration-300 ${
            checked
              ? 'bg-[#22c55e]/15 scale-110'
              : 'bg-[#f5f2ed]'
          }`}
        >
          {rule.emoji}
        </div>
        <div className="flex-1 text-left">
          <span className={`font-bold text-[15px] transition-colors ${checked ? 'text-[#22c55e]' : 'text-[#1a1a1a]'}`}>
            {rule.label}
          </span>
          {checked && (
            <span className="block text-[11px] font-semibold text-[#22c55e]/70 mt-0.5">
              Locked in today
            </span>
          )}
        </div>
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
            checked
              ? 'bg-[#22c55e] text-white shadow-lg shadow-[#22c55e]/30 scale-110'
              : 'bg-[#e8e4de]'
          }`}
        >
          {checked ? (
            <svg
              className="w-4.5 h-4.5 animate-check-pop"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 10l4 4 6-7" />
            </svg>
          ) : (
            <div className="w-3 h-3 rounded-full bg-[#d0ccc6]" />
          )}
        </div>
      </div>
    </button>
  );
}

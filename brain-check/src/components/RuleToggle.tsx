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
      className="w-full animate-fade-in-up"
      style={{ animationDelay: `${index * 50}ms`, opacity: 0 }}
    >
      <div
        className={`flex items-center gap-3.5 px-4 py-3.5 rounded-2xl transition-all duration-300 ${
          checked
            ? 'card-success'
            : 'card hover:border-white/10'
        }`}
      >
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-all shrink-0 ${
            checked ? 'bg-[#22c55e]/15 scale-105' : 'bg-white/[0.04]'
          }`}
        >
          {rule.emoji}
        </div>
        <div className="flex-1 text-left min-w-0">
          <span className={`font-bold text-[14px] block transition-colors ${checked ? 'text-[#22c55e]' : 'text-[#e0dfe8]'}`}>
            {rule.label}
          </span>
          {checked && (
            <span className="text-[11px] font-semibold text-[#22c55e]/60 block">
              Done today
            </span>
          )}
        </div>
        <div
          className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all shrink-0 ${
            checked
              ? 'bg-[#22c55e] shadow-lg shadow-[#22c55e]/25'
              : 'bg-white/[0.06] border border-white/10'
          }`}
        >
          {checked ? (
            <svg className="w-4 h-4 text-white animate-check-pop" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 10l4 4 6-7" />
            </svg>
          ) : null}
        </div>
      </div>
    </button>
  );
}

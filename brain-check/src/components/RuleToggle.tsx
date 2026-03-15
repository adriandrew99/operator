import type { RuleInfo } from '../types';

interface RuleToggleProps {
  rule: RuleInfo;
  checked: boolean;
  onToggle: () => void;
}

export default function RuleToggle({ rule, checked, onToggle }: RuleToggleProps) {
  return (
    <button
      onClick={onToggle}
      className={`flex items-center gap-3 w-full px-4 py-3.5 rounded-2xl transition-all duration-200 border-2 ${
        checked
          ? 'bg-[#5ecc8b]/10 border-[#5ecc8b] shadow-sm'
          : 'bg-white border-[#e8e4de] hover:border-[#d0ccc6]'
      }`}
    >
      <span className="text-2xl">{rule.emoji}</span>
      <span className="flex-1 text-left font-semibold text-[15px]">{rule.label}</span>
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
          checked ? 'bg-[#5ecc8b] text-white' : 'bg-[#e8e4de]'
        }`}
      >
        {checked && (
          <svg
            className="w-4 h-4 animate-check-pop"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 10l4 4 6-7" />
          </svg>
        )}
      </div>
    </button>
  );
}

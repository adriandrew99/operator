import { BRAIN_INTEL, DEFAULT_BRAIN_INTEL } from '../constants';

interface BrainIntelCardProps {
  dayNumber: number;
}

export default function BrainIntelCard({ dayNumber }: BrainIntelCardProps) {
  const intel = BRAIN_INTEL[dayNumber] || DEFAULT_BRAIN_INTEL;

  return (
    <div className="bg-white rounded-2xl p-5 border border-[#e8e4de] shadow-sm animate-fade-in">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">🧬</span>
        <h3 className="font-bold text-sm text-[#2d2a26]">Brain Intel — Day {dayNumber}</h3>
      </div>
      <div className="space-y-3">
        <div className="bg-[#f5f0ff] rounded-xl p-3">
          <p className="text-xs font-semibold text-purple-600 mb-1">Science Fact</p>
          <p className="text-sm text-[#2d2a26] leading-relaxed">{intel.fact}</p>
        </div>
        <div className="bg-[#fff5f0] rounded-xl p-3">
          <p className="text-xs font-semibold text-[#e06060] mb-1">Warning</p>
          <p className="text-sm text-[#2d2a26] leading-relaxed">{intel.warning}</p>
        </div>
      </div>
    </div>
  );
}

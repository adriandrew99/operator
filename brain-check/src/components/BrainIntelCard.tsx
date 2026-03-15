import { BRAIN_INTEL, DEFAULT_BRAIN_INTEL } from '../constants';

interface BrainIntelCardProps {
  dayNumber: number;
}

export default function BrainIntelCard({ dayNumber }: BrainIntelCardProps) {
  const intel = BRAIN_INTEL[dayNumber] || DEFAULT_BRAIN_INTEL;

  return (
    <div className="card-solid p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center">
          <span className="text-white text-sm">🧬</span>
        </div>
        <div>
          <h3 className="font-bold text-sm text-[#1a1a1a] leading-tight">Brain Intel</h3>
          <span className="text-[10px] text-[#9ca3af] font-semibold">Day {dayNumber}</span>
        </div>
      </div>
      <div className="space-y-2.5">
        <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl p-3.5">
          <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-1.5">Science Fact</p>
          <p className="text-[13px] text-[#1a1a1a] leading-relaxed">{intel.fact}</p>
        </div>
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-3.5">
          <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-1.5">Stay Alert</p>
          <p className="text-[13px] text-[#1a1a1a] leading-relaxed">{intel.warning}</p>
        </div>
      </div>
    </div>
  );
}

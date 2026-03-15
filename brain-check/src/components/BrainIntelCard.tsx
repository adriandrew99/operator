import { BRAIN_INTEL, DEFAULT_BRAIN_INTEL } from '../constants';

interface BrainIntelCardProps {
  dayNumber: number;
}

export default function BrainIntelCard({ dayNumber }: BrainIntelCardProps) {
  const intel = BRAIN_INTEL[dayNumber] || DEFAULT_BRAIN_INTEL;

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center">
          <span className="text-white text-sm">🧬</span>
        </div>
        <div>
          <h3 className="font-bold text-sm text-[#e0dfe8] leading-tight">Brain Intel</h3>
          <span className="text-[10px] text-[#6b6b80] font-semibold">Day {dayNumber}</span>
        </div>
      </div>
      <div className="space-y-2.5">
        <div className="bg-indigo-500/10 border border-indigo-500/15 rounded-xl p-3.5">
          <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-1.5">Science Fact</p>
          <p className="text-[13px] text-[#c8c7d4] leading-relaxed">{intel.fact}</p>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/15 rounded-xl p-3.5">
          <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-1.5">Stay Alert</p>
          <p className="text-[13px] text-[#c8c7d4] leading-relaxed">{intel.warning}</p>
        </div>
      </div>
    </div>
  );
}

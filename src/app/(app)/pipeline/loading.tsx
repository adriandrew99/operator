export default function PipelineLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="skeleton skeleton-heading w-24 h-6" />
        <div className="skeleton w-28 h-8 rounded" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="skeleton skeleton-card h-20" />
        ))}
      </div>
      {[...Array(3)].map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="skeleton skeleton-text w-32 h-4" />
          <div className="skeleton skeleton-card h-24" />
        </div>
      ))}
    </div>
  );
}

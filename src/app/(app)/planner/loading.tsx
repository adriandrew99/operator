export default function PlannerLoading() {
  return (
    <div className="space-y-4">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="skeleton w-7 h-7 rounded-lg" />
          <div className="skeleton skeleton-text w-32 h-5" />
          <div className="skeleton w-7 h-7 rounded-lg" />
        </div>
        <div className="flex gap-2">
          <div className="skeleton w-24 h-8 rounded-full" />
          <div className="skeleton w-16 h-8 rounded-lg" />
        </div>
      </div>
      {/* Capacity bar skeleton */}
      <div className="skeleton w-full h-1.5 rounded-full" />
      {/* Goals skeleton */}
      <div className="skeleton skeleton-card h-20" />
      {/* Backlog skeleton */}
      <div className="skeleton skeleton-card h-14" />
      {/* Day columns skeleton */}
      <div className="hidden md:grid md:grid-cols-7 gap-1.5">
        {[...Array(7)].map((_, i) => (
          <div key={i} className="skeleton-card border border-border rounded-xl p-2.5 space-y-2">
            <div className="flex items-center gap-1.5">
              <div className="skeleton skeleton-text w-8 h-4" />
              <div className="skeleton w-5 h-5 rounded-full" />
            </div>
            <div className="skeleton w-full h-1 rounded-full" />
            <div className="space-y-1">
              <div className="skeleton skeleton-text w-12 h-3" />
              <div className="skeleton h-8 rounded-lg" />
            </div>
            <div className="space-y-1">
              <div className="skeleton skeleton-text w-14 h-3" />
              <div className="skeleton h-8 rounded-lg" />
            </div>
            <div className="space-y-1">
              <div className="skeleton skeleton-text w-10 h-3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

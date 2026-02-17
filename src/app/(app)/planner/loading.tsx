export default function PlannerLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 bg-surface-secondary rounded-lg" />
          <div className="h-5 w-32 bg-surface-secondary rounded" />
          <div className="h-7 w-7 bg-surface-secondary rounded-lg" />
        </div>
        <div className="flex gap-2">
          <div className="h-8 w-24 bg-surface-secondary rounded-full" />
          <div className="h-8 w-16 bg-surface-secondary rounded-lg" />
        </div>
      </div>
      {/* Capacity bar skeleton */}
      <div className="h-1.5 w-full bg-surface-secondary rounded-full" />
      {/* Goals skeleton */}
      <div className="h-20 bg-surface-secondary/30 border border-border/50 rounded-xl" />
      {/* Backlog skeleton */}
      <div className="h-14 bg-surface-secondary/30 border border-border/50 rounded-xl" />
      {/* Day columns skeleton */}
      <div className="hidden md:grid md:grid-cols-7 gap-1.5">
        {[...Array(7)].map((_, i) => (
          <div key={i} className="border border-border/50 rounded-xl p-2.5 space-y-2">
            <div className="flex items-center gap-1.5">
              <div className="h-4 w-8 bg-surface-secondary rounded" />
              <div className="h-5 w-5 bg-surface-secondary rounded-full" />
            </div>
            <div className="h-1 w-full bg-surface-secondary rounded-full" />
            <div className="space-y-1">
              <div className="h-3 w-12 bg-surface-secondary/50 rounded" />
              <div className="h-8 bg-surface-secondary/30 rounded-lg" />
            </div>
            <div className="space-y-1">
              <div className="h-3 w-14 bg-surface-secondary/50 rounded" />
              <div className="h-8 bg-surface-secondary/30 rounded-lg" />
            </div>
            <div className="space-y-1">
              <div className="h-3 w-10 bg-surface-secondary/50 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

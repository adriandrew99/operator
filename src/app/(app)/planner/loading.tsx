export default function PlannerLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-6 w-36 bg-surface-secondary rounded" />
        <div className="flex gap-2">
          <div className="h-8 w-8 bg-surface-secondary rounded" />
          <div className="h-8 w-8 bg-surface-secondary rounded" />
        </div>
      </div>
      <div className="grid grid-cols-7 gap-2">
        {[...Array(7)].map((_, i) => (
          <div key={i} className="h-64 bg-surface-secondary border border-border rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

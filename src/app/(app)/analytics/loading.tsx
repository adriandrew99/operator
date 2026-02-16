export default function AnalyticsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-6 w-28 bg-surface-secondary rounded" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-surface-secondary border border-border rounded-2xl" />
        ))}
      </div>
      <div className="h-64 bg-surface-secondary border border-border rounded-2xl" />
      <div className="h-48 bg-surface-secondary border border-border rounded-2xl" />
    </div>
  );
}

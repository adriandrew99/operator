export default function TodayLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-2">
        <div className="h-6 w-40 bg-surface-secondary rounded" />
        <div className="h-4 w-56 bg-surface-secondary rounded" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="h-32 bg-surface-secondary border border-border rounded-2xl" />
        <div className="h-32 bg-surface-secondary border border-border rounded-2xl" />
      </div>
      <div className="h-48 bg-surface-secondary border border-border rounded-2xl" />
      <div className="h-32 bg-surface-secondary border border-border rounded-2xl" />
    </div>
  );
}

export default function FinanceLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-6 w-24 bg-surface-secondary rounded" />
        <div className="h-8 w-32 bg-surface-secondary rounded" />
      </div>
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

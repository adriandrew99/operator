export default function TasksLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-6 w-20 bg-surface-secondary rounded" />
        <div className="h-8 w-28 bg-surface-secondary rounded" />
      </div>
      <div className="flex gap-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-8 w-20 bg-surface-secondary rounded-lg" />
        ))}
      </div>
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-16 bg-surface-secondary border border-border rounded-2xl" />
      ))}
    </div>
  );
}

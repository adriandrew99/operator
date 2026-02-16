export default function PipelineLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-6 w-24 bg-surface-secondary rounded" />
        <div className="h-8 w-28 bg-surface-secondary rounded" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 bg-surface-secondary border border-border rounded-2xl" />
        ))}
      </div>
      {[...Array(3)].map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="h-4 w-32 bg-surface-secondary rounded" />
          <div className="h-24 bg-surface-secondary border border-border rounded-2xl" />
        </div>
      ))}
    </div>
  );
}

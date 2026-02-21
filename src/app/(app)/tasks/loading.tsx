export default function TasksLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="skeleton skeleton-heading w-20 h-6" />
        <div className="skeleton w-28 h-8 rounded" />
      </div>
      <div className="flex gap-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="skeleton w-20 h-8 rounded-lg" />
        ))}
      </div>
      {[...Array(5)].map((_, i) => (
        <div key={i} className="skeleton skeleton-card h-16" />
      ))}
    </div>
  );
}

export default function TodayLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="skeleton skeleton-heading w-40 h-6" />
        <div className="skeleton skeleton-text w-56 h-4" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="skeleton skeleton-card h-32" />
        <div className="skeleton skeleton-card h-32" />
      </div>
      <div className="skeleton skeleton-card h-48" />
      <div className="skeleton skeleton-card h-32" />
    </div>
  );
}

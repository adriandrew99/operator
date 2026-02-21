export default function AnalyticsLoading() {
  return (
    <div className="space-y-6">
      <div className="skeleton skeleton-heading w-28 h-6" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="skeleton skeleton-card h-24" />
        ))}
      </div>
      <div className="skeleton skeleton-card h-64" />
      <div className="skeleton skeleton-card h-48" />
    </div>
  );
}

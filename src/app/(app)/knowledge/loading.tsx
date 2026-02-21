export default function KnowledgeLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="skeleton skeleton-heading w-28 h-6" />
        <div className="skeleton w-28 h-8 rounded" />
      </div>
      {[...Array(4)].map((_, i) => (
        <div key={i} className="skeleton skeleton-card h-20" />
      ))}
    </div>
  );
}

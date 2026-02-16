export default function KnowledgeLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-6 w-28 bg-surface-secondary rounded" />
        <div className="h-8 w-28 bg-surface-secondary rounded" />
      </div>
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-20 bg-surface-secondary border border-border rounded-2xl" />
      ))}
    </div>
  );
}

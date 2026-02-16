export default function AppLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-2">
        <div className="h-6 w-32 bg-surface-secondary rounded" />
        <div className="h-4 w-48 bg-surface-secondary rounded" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="h-32 bg-surface-secondary border border-border rounded" />
        <div className="h-32 bg-surface-secondary border border-border rounded" />
      </div>
      <div className="h-48 bg-surface-secondary border border-border rounded" />
      <div className="h-32 bg-surface-secondary border border-border rounded" />
    </div>
  );
}

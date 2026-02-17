'use client';

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="text-center max-w-sm space-y-4">
        <div className="text-4xl">📡</div>
        <h1 className="text-lg font-semibold text-text-primary">You&apos;re offline</h1>
        <p className="text-sm text-text-secondary">
          Nexus needs an internet connection. Check your WiFi or cellular data and try again.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

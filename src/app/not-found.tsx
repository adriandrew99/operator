import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-text-primary">404</h1>
        <p className="text-sm text-text-secondary">Page not found.</p>
        <Link
          href="/today"
          className="inline-block text-sm text-accent hover:underline"
        >
          Back to Command Deck
        </Link>
      </div>
    </div>
  );
}

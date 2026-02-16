'use client';

import { Button } from '@/components/ui/Button';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4 text-center">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-text-primary">Something went wrong</h2>
        <p className="text-sm text-text-secondary max-w-md">
          {error.message || 'An unexpected error occurred. Try refreshing the page.'}
        </p>
      </div>
      <Button onClick={reset} variant="secondary" size="sm">
        Try Again
      </Button>
    </div>
  );
}

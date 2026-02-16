export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 safe-area-inset-top safe-area-inset-bottom">
      <div className="w-full max-w-sm card-surface border border-border rounded-2xl p-6 sm:p-8">
        {children}
      </div>
    </div>
  );
}

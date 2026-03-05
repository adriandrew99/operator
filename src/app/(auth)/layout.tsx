export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 safe-area-inset-top safe-area-inset-bottom">
      <div className="w-full max-w-sm bg-surface-secondary border border-border rounded-lg p-8 sm:p-10">
        {children}
      </div>
    </div>
  );
}

import { Sidebar } from '@/components/layout/Sidebar';
import { MobileNav } from '@/components/layout/MobileNav';
import { TopBar } from '@/components/layout/TopBar';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';
import { DebriefPopup } from '@/components/insights/DebriefPopup';
import { isWeeklyDebriefReady } from '@/actions/insights';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const debriefReady = await isWeeklyDebriefReady().catch(() => false);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar debriefReady={debriefReady} />
      <main className="flex-1 min-w-0 flex flex-col overflow-x-hidden">
        <TopBar />
        <div className="flex-1 max-w-5xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-8 pb-28 md:pb-8">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </div>
      </main>
      <MobileNav debriefReady={debriefReady} />
      <DebriefPopup debriefReady={debriefReady} />
    </div>
  );
}

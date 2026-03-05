'use client';

import { type ReactNode } from 'react';
import { SidebarProvider } from '@/providers/SidebarProvider';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { MobileNav } from './MobileNav';
import { ErrorBoundary } from './ErrorBoundary';
import { FocusRefresh } from './FocusRefresh';
import { CommandPalette } from './CommandPalette';
import { DebriefPopup } from '@/components/insights/DebriefPopup';
import { FinanceChat } from '@/components/chat/FinanceChat';

interface ClientShellProps {
  children: ReactNode;
  debriefReady: boolean;
}

export function ClientShell({ children, debriefReady }: ClientShellProps) {
  return (
    <SidebarProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar debriefReady={debriefReady} />
        <main className="flex-1 min-w-0 flex flex-col overflow-y-auto overflow-x-hidden">
          <TopBar />
          <div className="flex-1 w-full max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-10 py-8 sm:py-10 pb-28 md:pb-10 page-enter">
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </div>
        </main>
        <MobileNav debriefReady={debriefReady} />
        <FocusRefresh />
        <CommandPalette />
        <DebriefPopup debriefReady={debriefReady} />
        <FinanceChat />
      </div>
    </SidebarProvider>
  );
}

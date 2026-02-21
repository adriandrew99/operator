import { ClientShell } from '@/components/layout/ClientShell';
import { isWeeklyDebriefReady } from '@/actions/insights';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const debriefReady = await isWeeklyDebriefReady().catch(() => false);

  return (
    <ClientShell debriefReady={debriefReady}>
      {children}
    </ClientShell>
  );
}

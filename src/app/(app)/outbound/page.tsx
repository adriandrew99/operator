import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getCampaigns } from '@/actions/outbound';
import { OutboundDashboard } from './OutboundDashboard';

export const dynamic = 'force-dynamic';

export default async function OutboundPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const campaigns = await getCampaigns().catch(() => []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-page-title text-text-primary">Outbound</h1>
        <p className="text-sm text-text-tertiary mt-1">Track LinkedIn campaigns, sends, responses, and closes</p>
      </div>
      <OutboundDashboard campaigns={campaigns} />
    </div>
  );
}

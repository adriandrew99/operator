import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getLeads } from '@/actions/pipeline';
import { PipelineDashboard } from './PipelineDashboard';

export const dynamic = 'force-dynamic';

export default async function PipelinePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const leads = await getLeads();

  return <PipelineDashboard leads={leads || []} />;
}

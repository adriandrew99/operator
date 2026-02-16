import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getKnowledgeEntries } from '@/actions/knowledge';
import { KnowledgeDashboard } from './KnowledgeDashboard';

export const dynamic = 'force-dynamic';

export default async function KnowledgePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const entries = await getKnowledgeEntries();

  return <KnowledgeDashboard entries={entries || []} />;
}

'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function getLeads() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('pipeline_leads')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function createLead(leadData: {
  name: string;
  company?: string;
  estimated_value?: number;
  stage?: string;
  probability?: number;
  next_action?: string;
  next_action_date?: string;
  source?: string;
  notes?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('pipeline_leads')
    .insert({ user_id: user.id, ...leadData });

  if (error) throw error;
  revalidatePath('/pipeline');
}

export async function updateLead(id: string, updates: Record<string, unknown>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  if (updates.stage === 'closed') {
    updates.closed_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from('pipeline_leads')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) throw error;
  revalidatePath('/pipeline');
}

export async function convertLeadToClient(leadId: string, clientData: {
  name: string;
  retainer_amount?: number;
  contract_start?: string;
  contract_end?: string;
  payment_day?: number;
  renewal_probability?: number;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // 1. Mark lead as closed
  const { error: leadError } = await supabase
    .from('pipeline_leads')
    .update({ stage: 'closed', closed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', leadId)
    .eq('user_id', user.id);

  if (leadError) throw leadError;

  // 2. Create the client
  const { error: clientError } = await supabase
    .from('clients')
    .insert({ user_id: user.id, ...clientData });

  if (clientError) throw clientError;

  revalidatePath('/pipeline');
  revalidatePath('/finance');
}

export async function deleteLead(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('pipeline_leads')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) throw error;
  revalidatePath('/pipeline');
}

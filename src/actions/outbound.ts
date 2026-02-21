'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { OutboundCampaignWithEntries } from '@/lib/types/database';

// ━━━ Campaigns ━━━

export async function getCampaigns(): Promise<OutboundCampaignWithEntries[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: campaigns, error: cErr } = await supabase
    .from('outbound_campaigns')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (cErr) throw cErr;
  if (!campaigns || campaigns.length === 0) return [];

  const { data: entries, error: eErr } = await supabase
    .from('outbound_entries')
    .select('*')
    .eq('user_id', user.id)
    .order('date', { ascending: false });

  if (eErr) throw eErr;

  const entriesByCampaign = new Map<string, typeof entries>();
  for (const entry of entries || []) {
    const list = entriesByCampaign.get(entry.campaign_id) || [];
    list.push(entry);
    entriesByCampaign.set(entry.campaign_id, list);
  }

  return campaigns.map(campaign => {
    const campaignEntries = entriesByCampaign.get(campaign.id) || [];
    const totals = campaignEntries.reduce(
      (acc, e) => ({
        sends: acc.sends + (e.sends || 0),
        responses: acc.responses + (e.responses || 0),
        calls_booked: acc.calls_booked + (e.calls_booked || 0),
        closes: acc.closes + (e.closes || 0),
      }),
      { sends: 0, responses: 0, calls_booked: 0, closes: 0 }
    );
    return { ...campaign, entries: campaignEntries, totals };
  });
}

export async function createCampaign(data: {
  name: string;
  description?: string;
  channel?: string;
  message_template?: string;
  target_audience?: string;
  start_date?: string;
  end_date?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('outbound_campaigns')
    .insert({ user_id: user.id, ...data });

  if (error) throw error;
  revalidatePath('/outbound');
}

export async function updateCampaign(id: string, updates: Record<string, unknown>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('outbound_campaigns')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) throw error;
  revalidatePath('/outbound');
}

export async function deleteCampaign(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('outbound_campaigns')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) throw error;
  revalidatePath('/outbound');
}

// ━━━ Entries ━━━

export async function addEntry(data: {
  campaign_id: string;
  date?: string;
  sends?: number;
  responses?: number;
  calls_booked?: number;
  closes?: number;
  notes?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('outbound_entries')
    .insert({
      user_id: user.id,
      date: data.date || new Date().toISOString().split('T')[0],
      ...data,
    });

  if (error) throw error;
  revalidatePath('/outbound');
}

export async function updateEntry(id: string, updates: Record<string, unknown>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('outbound_entries')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) throw error;
  revalidatePath('/outbound');
}

export async function deleteEntry(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('outbound_entries')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) throw error;
  revalidatePath('/outbound');
}

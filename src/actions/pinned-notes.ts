'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { PinnedNote } from '@/lib/types/database';

export async function getPinnedNote(): Promise<PinnedNote | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('pinned_notes')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_pinned', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .single();

  return data as PinnedNote | null;
}

export async function savePinnedNote(content: string): Promise<PinnedNote | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Unpin all existing
  await supabase
    .from('pinned_notes')
    .update({ is_pinned: false })
    .eq('user_id', user.id)
    .eq('is_pinned', true);

  if (!content.trim()) {
    revalidatePath('/today');
    return null;
  }

  // Create new pinned note
  const { data } = await supabase
    .from('pinned_notes')
    .insert({
      user_id: user.id,
      content: content.trim(),
      is_pinned: true,
    })
    .select()
    .single();

  revalidatePath('/today');
  return data as PinnedNote | null;
}

export async function unpinNote(noteId: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from('pinned_notes')
    .update({ is_pinned: false })
    .eq('id', noteId)
    .eq('user_id', user.id);

  revalidatePath('/today');
}

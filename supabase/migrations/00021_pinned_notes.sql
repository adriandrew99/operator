-- Pinned notes: quick notes that appear in the Today hero
-- Users can pin/unpin. Only one pinned at a time (latest pinned wins).

create table if not exists pinned_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  content text not null,
  is_pinned boolean default true not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table pinned_notes enable row level security;

create policy "Users can manage their own pinned notes"
  on pinned_notes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index idx_pinned_notes_user_pinned on pinned_notes(user_id, is_pinned) where is_pinned = true;

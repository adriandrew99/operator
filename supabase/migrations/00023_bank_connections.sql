-- 00023: Bank connections & transactions (GoCardless Open Banking)
-- Stores linked bank accounts and synced transaction data

-- Bank connections table
create table if not exists bank_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  institution_id text not null,
  institution_name text not null,
  institution_logo text,
  requisition_id text not null,
  account_id text not null,
  account_name text,
  status text not null default 'active',
  last_synced_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table bank_connections enable row level security;
drop policy if exists "Users can manage own connections" on bank_connections;
create policy "Users can manage own connections" on bank_connections for all using (auth.uid() = user_id);

-- Bank transactions table
create table if not exists bank_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  connection_id uuid references bank_connections(id) on delete cascade not null,
  external_id text not null,
  date date not null,
  description text not null,
  amount numeric not null,
  currency text default 'GBP',
  category text,
  is_recurring boolean default false,
  recurring_group text,
  merchant_name text,
  balance_after numeric,
  raw_data jsonb,
  created_at timestamptz default now()
);

alter table bank_transactions enable row level security;
drop policy if exists "Users can manage own transactions" on bank_transactions;
create policy "Users can manage own transactions" on bank_transactions for all using (auth.uid() = user_id);

-- Dedup index: prevent duplicate transaction imports
create unique index if not exists bank_transactions_dedup on bank_transactions(user_id, connection_id, external_id);

-- Date index: fast date-range queries
create index if not exists bank_transactions_date on bank_transactions(user_id, date desc);

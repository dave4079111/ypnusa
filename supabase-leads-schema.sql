-- Production Supabase/Postgres schema for YPN USA.
-- Apply with a migration role. The application must use a server-only service
-- credential; no table grants anonymous browser access.

create extension if not exists pgcrypto;

create table if not exists public.mlo_profiles (
  id text primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  email text not null unique,
  company text,
  nmls_id text,
  is_admin boolean not null default false
);

create table if not exists public.subscriptions (
  id text primary key,
  mlo_id text not null references public.mlo_profiles(id) on delete restrict,
  stripe_customer_id text not null unique,
  stripe_subscription_id text not null unique,
  tier text not null check (tier in ('starter', 'pro', 'elite')),
  status text not null check (status in ('trialing', 'active', 'past_due', 'cancelled')),
  claimed_zips text[] not null default '{}',
  started_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.auth_sessions (
  id_hash text primary key,
  mlo_id text not null references public.mlo_profiles(id) on delete cascade,
  created_at timestamptz not null,
  expires_at timestamptz not null
);
create index if not exists auth_sessions_expiry_idx on public.auth_sessions(expires_at);

create table if not exists public.consumed_sso_tokens (
  jti_hash text primary key,
  consumed_at timestamptz not null,
  expires_at timestamptz not null
);
create index if not exists consumed_sso_tokens_expiry_idx
  on public.consumed_sso_tokens(expires_at);

create table if not exists public.webhook_events (
  event_id text primary key,
  source text not null,
  status text not null check (status in ('processing', 'completed', 'failed')),
  received_at timestamptz not null default now(),
  completed_at timestamptz,
  last_error text
);

create table if not exists public.borrower_leads (
  id text primary key,
  event_id text unique,
  assigned_mlo_id text not null references public.mlo_profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  name text not null,
  phone text not null,
  email text not null,
  property_zip text,
  loan_program text not null,
  timeline text not null,
  estimated_credit_band text not null,
  purchase_refi_intent text not null,
  contact_consent boolean not null,
  funnel_source text not null,
  qualification jsonb not null,
  status text not null default 'new'
);
create index if not exists borrower_leads_mlo_created_idx
  on public.borrower_leads(assigned_mlo_id, created_at desc);

create table if not exists public.follow_ups (
  id text primary key,
  borrower_lead_id text not null references public.borrower_leads(id) on delete cascade,
  plan text not null,
  channel text not null check (channel in ('email', 'sms')),
  recipient text not null,
  scheduled_at timestamptz not null,
  status text not null check (status in ('pending', 'sending', 'sent', 'failed')),
  attempt_count integer not null default 0,
  provider text,
  provider_message_id text,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index if not exists follow_ups_due_idx
  on public.follow_ups(status, scheduled_at)
  where status = 'pending';

alter table public.mlo_profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.auth_sessions enable row level security;
alter table public.consumed_sso_tokens enable row level security;
alter table public.webhook_events enable row level security;
alter table public.borrower_leads enable row level security;
alter table public.follow_ups enable row level security;

revoke all on all tables in schema public from anon, authenticated;
grant select, insert, update, delete on all tables in schema public to service_role;

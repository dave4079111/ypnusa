-- Run in Supabase SQL editor to create the leads table for YPN AI intake.

create extension if not exists "uuid-ossp";

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid (),
  created_at timestamptz not null default now (),
  name text not null,
  phone text not null,
  email text not null,
  loan_type text not null,
  loan_program text not null,
  credit_score text not null,
  income text not null,
  purchase_price text not null,
  timeline text not null,
  first_time_buyer text,
  has_realtor text not null,
  is_veteran boolean not null default false,
  notes text,
  lead_score numeric not null,
  lead_quality text not null,
  source_url text,
  recommended_program text not null,
  status text not null default 'new'
);

alter table public.leads enable row level security;

create policy "Allow anon insert leads"
on public.leads for insert to anon with check (true);

create policy "Allow anon select leads"
on public.leads for select to anon using (true);

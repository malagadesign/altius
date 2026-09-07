create extension if not exists pgcrypto;

create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  public_token text not null unique,
  full_name text not null,
  phone text not null,
  email text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete cascade,
  full_name text not null,
  phone text not null,
  email text not null,
  created_at timestamptz not null default now()
);

create index if not exists participants_created_at_idx on public.participants (created_at desc);
create index if not exists participants_public_token_idx on public.participants (public_token);
create index if not exists referrals_participant_id_idx on public.referrals (participant_id);

create unique index if not exists participants_full_name_unique_idx
on public.participants (lower(trim(regexp_replace(full_name, '[[:space:]]+', ' ', 'g'))));

create unique index if not exists participants_phone_unique_idx
on public.participants (phone);

create unique index if not exists participants_email_unique_idx
on public.participants (lower(trim(email)));

create unique index if not exists referrals_full_name_unique_idx
on public.referrals (lower(trim(regexp_replace(full_name, '[[:space:]]+', ' ', 'g'))));

create unique index if not exists referrals_phone_unique_idx
on public.referrals (phone);

create unique index if not exists referrals_email_unique_idx
on public.referrals (lower(trim(email)));

alter table public.participants enable row level security;
alter table public.referrals enable row level security;

grant usage on schema public to anon, authenticated;
grant insert on public.participants to anon, authenticated;
grant insert on public.referrals to anon, authenticated;

drop policy if exists "Public participants can be inserted" on public.participants;
create policy "Public participants can be inserted"
on public.participants for insert
with check (true);

drop policy if exists "Public referrals can be inserted" on public.referrals;
create policy "Public referrals can be inserted"
on public.referrals for insert
with check (true);

drop policy if exists "Public participants can be read" on public.participants;
drop policy if exists "Public referrals can be read" on public.referrals;

create or replace function public.get_participant_dashboard(token_input text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'participant',
    to_jsonb(p),
    'referrals',
    coalesce(
      (
        select jsonb_agg(to_jsonb(r) order by r.created_at desc)
        from public.referrals r
        where r.participant_id = p.id
      ),
      '[]'::jsonb
    )
  )
  from public.participants p
  where p.public_token = token_input
  limit 1;
$$;

revoke all on function public.get_participant_dashboard(text) from public;
grant execute on function public.get_participant_dashboard(text) to anon, authenticated;

create or replace function public.prevent_duplicate_contact()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_name text := lower(trim(regexp_replace(new.full_name, '[[:space:]]+', ' ', 'g')));
  normalized_email text := lower(trim(new.email));
begin
  if exists (
    select 1
    from public.participants p
    where lower(trim(regexp_replace(p.full_name, '[[:space:]]+', ' ', 'g'))) = normalized_name
       or p.phone = new.phone
       or lower(trim(p.email)) = normalized_email
  ) then
    raise exception 'duplicate_contact'
      using errcode = '23505';
  end if;

  if exists (
    select 1
    from public.referrals r
    where lower(trim(regexp_replace(r.full_name, '[[:space:]]+', ' ', 'g'))) = normalized_name
       or r.phone = new.phone
       or lower(trim(r.email)) = normalized_email
  ) then
    raise exception 'duplicate_contact'
      using errcode = '23505';
  end if;

  return new;
end;
$$;

drop trigger if exists participants_prevent_duplicate_contact on public.participants;
create trigger participants_prevent_duplicate_contact
before insert on public.participants
for each row execute function public.prevent_duplicate_contact();

drop trigger if exists referrals_prevent_duplicate_contact on public.referrals;
create trigger referrals_prevent_duplicate_contact
before insert on public.referrals
for each row execute function public.prevent_duplicate_contact();

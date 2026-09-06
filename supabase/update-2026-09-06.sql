alter table if exists public.participants
  add column if not exists public_token text;

update public.participants
set public_token = replace(gen_random_uuid()::text, '-', '')
where public_token is null;

alter table if exists public.participants
  alter column public_token set not null;

create unique index if not exists participants_public_token_unique_idx
on public.participants (public_token);

alter table if exists public.participants
  drop column if exists comuna,
  drop column if exists rut;

alter table if exists public.referrals
  drop column if exists comuna;

alter table if exists public.referrals
  alter column email set not null;

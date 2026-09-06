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

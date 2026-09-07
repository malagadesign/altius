drop index if exists public.participants_full_name_unique_idx;
drop index if exists public.referrals_full_name_unique_idx;

create unique index if not exists participants_phone_unique_idx
on public.participants (phone);

create unique index if not exists participants_email_unique_idx
on public.participants (lower(trim(email)));

create unique index if not exists referrals_phone_unique_idx
on public.referrals (phone);

create unique index if not exists referrals_email_unique_idx
on public.referrals (lower(trim(email)));

create or replace function public.prevent_duplicate_contact()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_email text := lower(trim(new.email));
begin
  if exists (
    select 1
    from public.participants p
    where p.phone = new.phone
       or lower(trim(p.email)) = normalized_email
  ) then
    raise exception 'duplicate_contact'
      using errcode = '23505';
  end if;

  if exists (
    select 1
    from public.referrals r
    where r.phone = new.phone
       or lower(trim(r.email)) = normalized_email
  ) then
    raise exception 'duplicate_contact'
      using errcode = '23505';
  end if;

  return new;
end;
$$;

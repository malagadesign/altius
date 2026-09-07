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

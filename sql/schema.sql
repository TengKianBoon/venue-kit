-- {{BRAND_NAME}} member system, schema v1 (10 Oct 2026)
-- Supabase project (pick a region close to your guests). Safe to re-run.

create extension if not exists pgcrypto;

-- 1. Who is an admin on the website (not the Supabase dashboard)
create table if not exists public.admin_emails (
  email text primary key,
  role text not null default 'staff' check (role in ('super_admin','admin','staff')),
  added_at timestamptz not null default now()
);
insert into public.admin_emails(email, role) values
  ('{{OWNER_EMAIL}}','super_admin'),
  ('{{ADMIN_EMAIL}}','admin')
on conflict (email) do nothing;

-- 2. Members (one row per signed-up customer)
create table if not exists public.members (
  id uuid primary key references auth.users(id) on delete cascade,
  member_code text unique not null default ('{{CODE_PREFIX}}' || upper(substr(encode(gen_random_bytes(6),'hex'),1,6))),
  full_name text,
  email text,
  phone text,
  phone_confirmed boolean not null default false,
  birthday date,
  tier text not null default 'Member',
  source text default 'Website',
  total_spend_idr bigint not null default 0,
  visit_count int not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.visits (
  id bigint generated always as identity primary key,
  member_id uuid not null references public.members(id) on delete cascade,
  visit_at timestamptz not null default now(),
  spend_idr bigint not null default 0,
  staff text,
  notes text
);

create table if not exists public.vouchers (
  id bigint generated always as identity primary key,
  member_id uuid not null references public.members(id) on delete cascade,
  title text not null,
  details text,
  discount_pct int,
  valid_from date not null default current_date,
  valid_to date,
  status text not null default 'active' check (status in ('active','used','expired','cancelled')),
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.bottles (
  id bigint generated always as identity primary key,
  member_id uuid not null references public.members(id) on delete cascade,
  bottle_name text not null,
  remaining_pct int not null default 100 check (remaining_pct between 0 and 100),
  stored_at date not null default current_date,
  expires_at date,
  status text not null default 'stored' check (status in ('stored','finished','expired','collected')),
  notes text
);

create table if not exists public.song_requests (
  id bigint generated always as identity primary key,
  member_id uuid references public.members(id) on delete set null,
  song_title text not null,
  artist text,
  dedication text,
  status text not null default 'new' check (status in ('new','queued','played','declined')),
  requested_at timestamptz not null default now()
);

-- 3. Helper: is the signed-in user a website admin?
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_emails a
                 where lower(a.email) = lower(coalesce(auth.jwt()->>'email','')));
$$;

-- 4. New sign-up -> create member row automatically
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.members (id, email, phone, full_name)
  values (new.id, new.email, new.phone,
          coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'))
  on conflict (id) do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- 5. Visits keep member totals up to date
create or replace function public.bump_member_totals() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.members m set
    visit_count = (select count(*) from public.visits v where v.member_id = m.id),
    total_spend_idr = (select coalesce(sum(spend_idr),0) from public.visits v where v.member_id = m.id)
  where m.id = coalesce(new.member_id, old.member_id);
  return null;
end; $$;
drop trigger if exists visits_totals on public.visits;
create trigger visits_totals after insert or update or delete on public.visits
  for each row execute function public.bump_member_totals();

-- 6. Row Level Security: members see only their own data; admins see all
alter table public.admin_emails  enable row level security;
alter table public.members       enable row level security;
alter table public.visits        enable row level security;
alter table public.vouchers      enable row level security;
alter table public.bottles       enable row level security;
alter table public.song_requests enable row level security;

drop policy if exists "admins all" on public.admin_emails;
create policy "admins all" on public.admin_emails for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "own row read" on public.members;
create policy "own row read" on public.members for select to authenticated using (id = auth.uid() or public.is_admin());
drop policy if exists "own row update" on public.members;
create policy "own row update" on public.members for update to authenticated using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());
drop policy if exists "admins insert delete members" on public.members;
create policy "admins insert delete members" on public.members for all to authenticated using (public.is_admin()) with check (public.is_admin());

do $$ declare t text; begin
  foreach t in array array['visits','vouchers','bottles'] loop
    execute format('drop policy if exists "own read" on public.%I', t);
    execute format('create policy "own read" on public.%I for select to authenticated using (member_id = auth.uid() or public.is_admin())', t);
    execute format('drop policy if exists "admins write" on public.%I', t);
    execute format('create policy "admins write" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

drop policy if exists "own read" on public.song_requests;
create policy "own read" on public.song_requests for select to authenticated using (member_id = auth.uid() or public.is_admin());
drop policy if exists "member create" on public.song_requests;
create policy "member create" on public.song_requests for insert to authenticated with check (member_id = auth.uid());
drop policy if exists "admins write" on public.song_requests;
create policy "admins write" on public.song_requests for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 7. Grants (new tables are not auto-exposed in this project). Anonymous visitors get nothing.
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.admin_emails, public.members, public.visits,
  public.vouchers, public.bottles, public.song_requests to authenticated;
grant usage, select on all sequences in schema public to authenticated;
-- members may only change name, phone and birthday on their own row; admins can change everything
create or replace function public.protect_member_fields() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.id := old.id; new.member_code := old.member_code; new.email := old.email;
    new.phone_confirmed := old.phone_confirmed; new.tier := old.tier; new.source := old.source;
    new.total_spend_idr := old.total_spend_idr; new.visit_count := old.visit_count;
    new.notes := old.notes; new.created_at := old.created_at;
  end if;
  return new;
end; $$;
drop trigger if exists members_protect on public.members;
create trigger members_protect before update on public.members
  for each row execute function public.protect_member_fields();
grant execute on function public.is_admin() to authenticated;

select '{{BRAND_SHORT}} schema v1 installed' as result;

-- v1.1 (11 Oct 2026): consent fields
alter table public.members add column if not exists privacy_accepted_at timestamptz;
alter table public.members add column if not exists marketing_opt_in boolean not null default false;
alter table public.members add column if not exists updated_at timestamptz;
-- {{BRAND_SHORT}} website content manager, schema v2 (12 Oct 2026). Safe to re-run.

-- 1. Website content: one JSON document per section (menu, singers, week, promos, banner)
create table if not exists public.site_content (
  key text primary key check (key in ('menu','singers','week','promos','banner')),
  data jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text
);
create table if not exists public.site_content_history (
  id bigint generated always as identity primary key,
  key text not null,
  data jsonb not null,
  saved_at timestamptz not null default now(),
  saved_by text
);
create or replace function public.site_content_keep_history() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.jwt()->>'email', new.updated_by, 'system');
  if tg_op = 'UPDATE' then
    insert into public.site_content_history(key, data, saved_by) values (old.key, old.data, old.updated_by);
    delete from public.site_content_history h where h.key = old.key and h.id not in
      (select id from public.site_content_history where key = old.key order by id desc limit 30);
  end if;
  return new;
end; $$;
drop trigger if exists site_content_history_trg on public.site_content;
create trigger site_content_history_trg before insert or update on public.site_content
  for each row execute function public.site_content_keep_history();

alter table public.site_content enable row level security;
alter table public.site_content_history enable row level security;
drop policy if exists "public read" on public.site_content;
create policy "public read" on public.site_content for select to anon, authenticated using (true);
drop policy if exists "admins write" on public.site_content;
create policy "admins write" on public.site_content for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admins read history" on public.site_content_history;
create policy "admins read history" on public.site_content_history for select to authenticated using (public.is_admin());
grant usage on schema public to anon;
grant select on public.site_content to anon, authenticated;
grant insert, update on public.site_content to authenticated;
grant select on public.site_content_history to authenticated;

-- 2. Image uploads (public bucket; only admins can upload or delete)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-images','site-images', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg','image/png','image/webp'];
drop policy if exists "site images public read" on storage.objects;
create policy "site images public read" on storage.objects for select to anon, authenticated using (bucket_id = 'site-images');
drop policy if exists "site images admin insert" on storage.objects;
create policy "site images admin insert" on storage.objects for insert to authenticated with check (bucket_id = 'site-images' and public.is_admin());
drop policy if exists "site images admin update" on storage.objects;
create policy "site images admin update" on storage.objects for update to authenticated using (bucket_id = 'site-images' and public.is_admin());
drop policy if exists "site images admin delete" on storage.objects;
create policy "site images admin delete" on storage.objects for delete to authenticated using (bucket_id = 'site-images' and public.is_admin());

-- 3. Promotion vouchers members can claim themselves (one per member per promotion)
alter table public.vouchers add column if not exists promo_slug text;
create unique index if not exists vouchers_member_promo_uniq on public.vouchers(member_id, promo_slug) where promo_slug is not null;

create or replace function public.claim_promo_voucher(p_slug text) returns public.vouchers
language plpgsql security definer set search_path = public as $$
declare pr jsonb; v public.vouchers; days int;
begin
  if auth.uid() is null then raise exception 'Please sign in first'; end if;
  if not exists (select 1 from public.members where id = auth.uid() and privacy_accepted_at is not null) then
    raise exception 'Please complete your profile first'; end if;
  select e into pr from public.site_content c, jsonb_array_elements(c.data) e
   where c.key = 'promos' and e->>'slug' = p_slug limit 1;
  if pr is null or coalesce((pr->'voucher'->>'enabled')::boolean,false) = false or coalesce((pr->>'active')::boolean,true) = false then
    raise exception 'This promotion has no voucher to claim'; end if;
  if pr->>'end' is not null and pr->>'end' <> '' and (pr->>'end')::date < current_date then
    raise exception 'This promotion has ended'; end if;
  select * into v from public.vouchers where member_id = auth.uid() and promo_slug = p_slug;
  if found then return v; end if;
  days := coalesce(nullif(pr->'voucher'->>'days','')::int, 30);
  insert into public.vouchers(member_id, title, details, discount_pct, valid_to, promo_slug)
  values (auth.uid(), coalesce(nullif(pr->'voucher'->>'title',''), pr->>'t'), pr->>'h',
          nullif(pr->'voucher'->>'pct','')::int, current_date + days, p_slug)
  returning * into v;
  return v;
end; $$;
grant execute on function public.claim_promo_voucher(text) to authenticated;

-- 4. Bulk-issue a voucher to a group of members (admins only)
create or replace function public.issue_voucher_bulk(p_target text, p_title text, p_details text, p_pct int, p_valid_to date)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if coalesce(trim(p_title),'') = '' then raise exception 'Voucher title is required'; end if;
  insert into public.vouchers(member_id, title, details, discount_pct, valid_to)
  select m.id, p_title, nullif(p_details,''), p_pct, p_valid_to from public.members m
  where case p_target
    when 'all' then true
    when 'birthday_month' then m.birthday is not null and extract(month from m.birthday) = extract(month from current_date)
    when 'promo_opt_in' then m.marketing_opt_in
    when 'new_30' then m.created_at >= now() - interval '30 days'
    when 'tier_silver' then m.tier = 'Silver'
    when 'tier_gold' then m.tier = 'Gold'
    when 'tier_vip' then m.tier = 'VIP'
    else false end;
  get diagnostics n = row_count;
  return n;
end; $$;
grant execute on function public.issue_voucher_bulk(text,text,text,int,date) to authenticated;

select '{{BRAND_SHORT}} schema v2 installed' as result;

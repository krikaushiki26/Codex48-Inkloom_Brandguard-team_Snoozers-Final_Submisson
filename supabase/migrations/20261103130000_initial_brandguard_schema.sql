create type public.app_role as enum ('writer', 'manager', 'reviewer', 'admin');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  email text not null unique,
  role public.app_role not null default 'writer',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role
  from public.profiles
  where id = auth.uid() and is_active
$$;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid() and is_active
  )
$$;

create or replace function public.is_manager_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.current_app_role() in ('manager', 'admin')
$$;

create or replace function public.is_reviewer_or_above()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.current_app_role() in ('reviewer', 'manager', 'admin')
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.current_app_role() = 'admin'
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, name, email)
  values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
      split_part(new.email, '@', 1)
    ),
    lower(new.email)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.prevent_admin_role_change()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.role = 'admin' and new.role is distinct from old.role then
    raise exception 'An admin account''s role cannot be changed here.';
  end if;
  return new;
end;
$$;

create trigger profiles_protect_admin_role
  before update on public.profiles
  for each row execute procedure public.prevent_admin_role_change();

create table public.brand_rules (
  id bigint generated always as identity primary key,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  description text not null check (char_length(btrim(description)) > 0),
  rule_type text not null check (char_length(btrim(rule_type)) between 1 and 30),
  approved_source text not null check (char_length(btrim(approved_source)) > 0),
  version integer not null default 1 check (version > 0),
  is_active boolean not null default true,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.content_reviews (
  id bigint generated always as identity primary key,
  submitted_by uuid not null references public.profiles(id),
  content text not null check (char_length(btrim(content)) between 1 and 50000),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'changes_requested', 'rejected')),
  reviewer_id uuid references public.profiles(id),
  reviewer_comment text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  constraint review_decision_has_reviewer check (
    (status = 'pending' and reviewer_id is null and reviewed_at is null)
    or (status <> 'pending' and reviewer_id is not null and reviewed_at is not null)
  )
);

create table public.content_check_results (
  id bigint generated always as identity primary key,
  checked_by uuid not null references public.profiles(id),
  compliance_score integer not null check (compliance_score between 0 and 100),
  total_flags integer not null default 0 check (total_flags >= 0),
  flags jsonb not null default '[]'::jsonb check (jsonb_typeof(flags) = 'array'),
  ai_enabled boolean not null default false,
  created_at timestamptz not null default now()
);

create index brand_rules_active_created_idx on public.brand_rules (is_active, created_at desc);
create index content_reviews_submitter_created_idx on public.content_reviews (submitted_by, created_at desc);
create index content_reviews_pending_created_idx on public.content_reviews (status, created_at asc);
create index content_check_results_user_created_idx on public.content_check_results (checked_by, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger brand_rules_set_updated_at
  before update on public.brand_rules
  for each row execute procedure public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.brand_rules enable row level security;
alter table public.content_reviews enable row level security;
alter table public.content_check_results enable row level security;

create policy "users read own profile and admins read all"
  on public.profiles for select to authenticated
  using (public.is_active_user() and (id = auth.uid() or public.is_admin()));

create policy "admins update non-admin profiles"
  on public.profiles for update to authenticated
  using (public.is_admin() and role <> 'admin')
  with check (public.is_admin() and role <> 'admin');

create policy "authenticated users read active rules"
  on public.brand_rules for select to authenticated
  using (public.is_active_user() and (is_active or public.is_manager_or_admin()));

create policy "managers create rules"
  on public.brand_rules for insert to authenticated
  with check (public.is_active_user() and public.is_manager_or_admin() and created_by = auth.uid());

create policy "managers update rules"
  on public.brand_rules for update to authenticated
  using (public.is_active_user() and public.is_manager_or_admin())
  with check (public.is_active_user() and public.is_manager_or_admin());

create policy "managers delete rules"
  on public.brand_rules for delete to authenticated
  using (public.is_active_user() and public.is_manager_or_admin());

create policy "users submit and read their reviews"
  on public.content_reviews for select to authenticated
  using (public.is_active_user() and (submitted_by = auth.uid() or public.is_reviewer_or_above()));

create policy "users submit their own reviews"
  on public.content_reviews for insert to authenticated
  with check (public.is_active_user() and submitted_by = auth.uid() and status = 'pending');

create policy "users read own checks and managers read all checks"
  on public.content_check_results for select to authenticated
  using (public.is_active_user() and (checked_by = auth.uid() or public.is_manager_or_admin()));

revoke all on function public.current_app_role() from public;
revoke all on function public.is_active_user() from public;
revoke all on function public.is_manager_or_admin() from public;
revoke all on function public.is_reviewer_or_above() from public;
revoke all on function public.is_admin() from public;
grant execute on function public.current_app_role() to authenticated;
grant execute on function public.is_active_user() to authenticated;
grant execute on function public.is_manager_or_admin() to authenticated;
grant execute on function public.is_reviewer_or_above() to authenticated;
grant execute on function public.is_admin() to authenticated;

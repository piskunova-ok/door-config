-- Выполнять только в отдельном проекте Supabase для DOOR CONFIG.
-- Цены в таблицах — демонстрационные рублёвые тарифы, не прайс Torex.

create table if not exists public.door_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create table if not exists public.door_models (
  id text primary key check (id ~ '^[a-z][a-z0-9-]{1,62}$'),
  name text not null check (length(btrim(name)) between 1 and 100),
  tagline text not null default '',
  description text not null default '',
  features text[] not null default '{}',
  base_price integer not null check (base_price >= 0),
  asset_model_id text not null check (asset_model_id in ('dc-01-classic','dc-02-minimal','dc-03-woodline','dc-04-stone','dc-05-geo')),
  sizes text[] not null check (cardinality(sizes) > 0),
  is_visible boolean not null default false,
  sort_order integer not null default 100
);

create table if not exists public.door_finishes (
  model_id text not null references public.door_models(id) on delete cascade,
  code text not null check (code ~ '^[a-z][a-z0-9-]{1,62}$'),
  name text not null check (length(btrim(name)) between 1 and 100),
  detail text not null default '',
  tone text not null default '#777777' check (tone ~ '^#[0-9a-fA-F]{6}$'),
  surcharge integer not null check (surcharge >= 0),
  image_path text not null check (image_path ~ '^/images/doors/[a-z0-9-]+__[a-z0-9-]+[.]webp$'),
  is_visible boolean not null default true,
  sort_order integer not null default 100,
  primary key (model_id, code)
);

create table if not exists public.door_sizes (
  id text primary key,
  label text not null check (length(btrim(label)) > 0),
  surcharge integer not null check (surcharge >= 0),
  sort_order integer not null default 100
);

create table if not exists public.door_accessories (
  id text primary key check (id ~ '^[a-z][a-zA-Z0-9]{1,62}$'),
  name text not null check (length(btrim(name)) > 0),
  price integer not null check (price >= 0),
  is_visible boolean not null default true,
  sort_order integer not null default 100
);

create table if not exists public.door_service_tariffs (
  id text primary key check (id in ('delivery', 'installation')),
  price integer not null check (price >= 0)
);

alter table public.door_admins enable row level security;
alter table public.door_models enable row level security;
alter table public.door_finishes enable row level security;
alter table public.door_sizes enable row level security;
alter table public.door_accessories enable row level security;
alter table public.door_service_tariffs enable row level security;

-- Grants и RLS нужны вместе: у посетителя нет даже SQL-права записи.
revoke all on public.door_admins, public.door_models, public.door_finishes,
  public.door_sizes, public.door_accessories, public.door_service_tariffs
  from anon, authenticated;
grant select on public.door_admins to authenticated;
grant select on public.door_models, public.door_finishes, public.door_sizes,
  public.door_accessories, public.door_service_tariffs to anon, authenticated;
grant insert, update, delete on public.door_models, public.door_finishes,
  public.door_sizes, public.door_accessories, public.door_service_tariffs to authenticated;

-- Список администраторов заполняется только владельцем проекта через SQL Editor.
create policy "admin reads own membership" on public.door_admins
  for select to authenticated using (user_id = (select auth.uid()));

create policy "public reads visible models" on public.door_models
  for select to anon, authenticated using (is_visible);
create policy "admin reads all models" on public.door_models
  for select to authenticated using (
    exists (select 1 from public.door_admins a where a.user_id = (select auth.uid()))
  );
create policy "admin inserts models" on public.door_models
  for insert to authenticated with check (
    exists (select 1 from public.door_admins a where a.user_id = (select auth.uid()))
  );
create policy "admin updates models" on public.door_models
  for update to authenticated
  using (exists (select 1 from public.door_admins a where a.user_id = (select auth.uid())))
  with check (exists (select 1 from public.door_admins a where a.user_id = (select auth.uid())));
create policy "admin deletes models" on public.door_models
  for delete to authenticated using (
    exists (select 1 from public.door_admins a where a.user_id = (select auth.uid()))
  );

create policy "public reads visible finishes" on public.door_finishes
  for select to anon, authenticated using (
    is_visible and exists (
      select 1 from public.door_models m where m.id = model_id and m.is_visible
    )
  );
create policy "admin reads all finishes" on public.door_finishes
  for select to authenticated using (
    exists (select 1 from public.door_admins a where a.user_id = (select auth.uid()))
  );
create policy "admin inserts finishes" on public.door_finishes
  for insert to authenticated with check (
    exists (select 1 from public.door_admins a where a.user_id = (select auth.uid()))
  );
create policy "admin updates finishes" on public.door_finishes
  for update to authenticated
  using (exists (select 1 from public.door_admins a where a.user_id = (select auth.uid())))
  with check (exists (select 1 from public.door_admins a where a.user_id = (select auth.uid())));
create policy "admin deletes finishes" on public.door_finishes
  for delete to authenticated using (
    exists (select 1 from public.door_admins a where a.user_id = (select auth.uid()))
  );

create policy "public reads sizes" on public.door_sizes
  for select to anon, authenticated using (surcharge >= 0);
create policy "admin inserts sizes" on public.door_sizes
  for insert to authenticated with check (
    exists (select 1 from public.door_admins a where a.user_id = (select auth.uid()))
  );
create policy "admin updates sizes" on public.door_sizes
  for update to authenticated
  using (exists (select 1 from public.door_admins a where a.user_id = (select auth.uid())))
  with check (exists (select 1 from public.door_admins a where a.user_id = (select auth.uid())));
create policy "admin deletes sizes" on public.door_sizes
  for delete to authenticated using (
    exists (select 1 from public.door_admins a where a.user_id = (select auth.uid()))
  );

create policy "public reads visible accessories" on public.door_accessories
  for select to anon, authenticated using (is_visible);
create policy "admin reads all accessories" on public.door_accessories
  for select to authenticated using (
    exists (select 1 from public.door_admins a where a.user_id = (select auth.uid()))
  );
create policy "admin inserts accessories" on public.door_accessories
  for insert to authenticated with check (
    exists (select 1 from public.door_admins a where a.user_id = (select auth.uid()))
  );
create policy "admin updates accessories" on public.door_accessories
  for update to authenticated
  using (exists (select 1 from public.door_admins a where a.user_id = (select auth.uid())))
  with check (exists (select 1 from public.door_admins a where a.user_id = (select auth.uid())));
create policy "admin deletes accessories" on public.door_accessories
  for delete to authenticated using (
    exists (select 1 from public.door_admins a where a.user_id = (select auth.uid()))
  );

create policy "public reads services" on public.door_service_tariffs
  for select to anon, authenticated using (id in ('delivery', 'installation'));
create policy "admin inserts services" on public.door_service_tariffs
  for insert to authenticated with check (
    exists (select 1 from public.door_admins a where a.user_id = (select auth.uid()))
  );
create policy "admin updates services" on public.door_service_tariffs
  for update to authenticated
  using (exists (select 1 from public.door_admins a where a.user_id = (select auth.uid())))
  with check (exists (select 1 from public.door_admins a where a.user_id = (select auth.uid())));
create policy "admin deletes services" on public.door_service_tariffs
  for delete to authenticated using (
    exists (select 1 from public.door_admins a where a.user_id = (select auth.uid()))
  );

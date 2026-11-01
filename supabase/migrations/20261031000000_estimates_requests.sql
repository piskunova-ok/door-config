-- Применять только в отдельном проекте DOOR CONFIG после миграции каталога.
create table public.door_estimates (
  id uuid primary key default gen_random_uuid(),
  number text unique not null,
  created_at timestamptz not null default now(),
  configuration jsonb not null,
  snapshot jsonb not null,
  total integer not null check (total >= 0)
);

create table public.door_requests (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null unique references public.door_estimates(id),
  created_at timestamptz not null default now(),
  customer_name text not null,
  phone text not null,
  email text,
  comment text not null default '',
  consent_at timestamptz not null,
  status text not null default 'new' check (status in ('new','in_progress','completed')),
  ip_hash text not null
);
create index door_requests_created_at_idx on public.door_requests (created_at desc);
create index door_requests_rate_idx on public.door_requests (ip_hash, created_at desc);

alter table public.door_estimates enable row level security;
alter table public.door_requests enable row level security;
revoke all on public.door_estimates, public.door_requests from anon, authenticated;
grant select on public.door_estimates, public.door_requests to authenticated;
grant update (status) on public.door_requests to authenticated;
create policy "admins read estimates" on public.door_estimates for select to authenticated
  using (exists (select 1 from public.door_admins where user_id = (select auth.uid())));
create policy "admins read requests" on public.door_requests for select to authenticated
  using (exists (select 1 from public.door_admins where user_id = (select auth.uid())));
create policy "admins update request status" on public.door_requests for update to authenticated
  using (exists (select 1 from public.door_admins where user_id = (select auth.uid())))
  with check (exists (select 1 from public.door_admins where user_id = (select auth.uid())));

-- Единственная точка публичной записи. Вызывать только из Edge Function с service_role.
create function public.create_door_request(p_config jsonb, p_contact jsonb, p_ip_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_model public.door_models%rowtype;
  v_finish public.door_finishes%rowtype;
  v_size public.door_sizes%rowtype;
  v_delivery public.door_service_tariffs%rowtype;
  v_installation public.door_service_tariffs%rowtype;
  v_accessory public.door_accessories%rowtype;
  v_accessory_ids text[];
  v_id text;
  v_lines jsonb := '[]'::jsonb;
  v_total bigint := 0;
  v_estimate_id uuid;
  v_request_id uuid;
  v_number text;
  v_snapshot jsonb;
  v_name text := btrim(coalesce(p_contact->>'name',''));
  v_phone text := btrim(coalesce(p_contact->>'phone',''));
  v_email text := nullif(btrim(coalesce(p_contact->>'email','')), '');
  v_comment text := btrim(coalesce(p_contact->>'comment',''));
begin
  if p_config is null or jsonb_typeof(p_config) <> 'object' or p_contact is null or jsonb_typeof(p_contact) <> 'object'
    or p_ip_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid_input'; end if;
  if length(v_name) not between 2 and 100 or v_phone !~ '^\+?[0-9 ()-]{7,25}$'
    or (v_email is not null and (length(v_email) > 254 or v_email !~ '^[^@ ]+@[^@ ]+\.[^@ ]+$'))
    or length(v_comment) > 2000 or p_contact->>'consent' <> 'true' then raise exception 'invalid_contact'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_ip_hash, 0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_phone, 1));
  if (select count(*) from public.door_requests where ip_hash = p_ip_hash and created_at > now() - interval '1 hour') >= 5
    then raise exception 'rate_limited'; end if;
  if (select count(*) from public.door_requests where phone = v_phone and created_at > now() - interval '1 hour') >= 3
    then raise exception 'rate_limited'; end if;
  if p_config->>'delivery' not in ('true','false') or p_config->>'installation' not in ('true','false')
    or jsonb_typeof(p_config->'accessoryIds') <> 'array' then raise exception 'invalid_configuration'; end if;
  select * into v_model from public.door_models where id = p_config->>'modelId' and is_visible;
  if not found then raise exception 'invalid_model'; end if;
  select * into v_finish from public.door_finishes where model_id = v_model.id and code = p_config->>'finishId' and is_visible;
  if not found then raise exception 'invalid_finish'; end if;
  select * into v_size from public.door_sizes where id = p_config->>'sizeId' and id = any(v_model.sizes);
  if not found then raise exception 'invalid_size'; end if;
  select * into v_delivery from public.door_service_tariffs where id = 'delivery';
  if not found then raise exception 'missing_delivery'; end if;
  select * into v_installation from public.door_service_tariffs where id = 'installation';
  if not found then raise exception 'missing_installation'; end if;
  if jsonb_array_length(p_config->'accessoryIds') > 20 then raise exception 'invalid_accessories'; end if;
  select coalesce(array_agg(value), array[]::text[]) into v_accessory_ids
    from jsonb_array_elements_text(p_config->'accessoryIds') as t(value);
  if cardinality(v_accessory_ids) <> (select count(distinct x) from unnest(v_accessory_ids) as x)
    then raise exception 'duplicate_accessories'; end if;
  v_lines := v_lines || jsonb_build_array(jsonb_build_object('key','base','label','Дверь ' || v_model.name || ' — демонстрационная базовая стоимость','amount',v_model.base_price));
  v_lines := v_lines || jsonb_build_array(jsonb_build_object('key','finish','label','Отделка — ' || v_finish.name,'amount',v_finish.surcharge));
  v_lines := v_lines || jsonb_build_array(jsonb_build_object('key','size','label','Размер — ' || v_size.label,'amount',v_size.surcharge));
  v_total := v_model.base_price::bigint + v_finish.surcharge + v_size.surcharge;
  foreach v_id in array v_accessory_ids loop
    select * into v_accessory from public.door_accessories where id = v_id and is_visible;
    if not found then raise exception 'invalid_accessory'; end if;
    v_lines := v_lines || jsonb_build_array(jsonb_build_object('key',v_id,'label',v_accessory.name,'amount',v_accessory.price));
    v_total := v_total + v_accessory.price;
  end loop;
  v_lines := v_lines || jsonb_build_array(jsonb_build_object('key','delivery','label','Доставка — ' || case when p_config->>'delivery' = 'true' then 'требуется' else 'не требуется' end,'amount',case when p_config->>'delivery' = 'true' then v_delivery.price else 0 end));
  v_lines := v_lines || jsonb_build_array(jsonb_build_object('key','installation','label','Монтаж — ' || case when p_config->>'installation' = 'true' then 'требуется' else 'не требуется' end,'amount',case when p_config->>'installation' = 'true' then v_installation.price else 0 end));
  if p_config->>'delivery' = 'true' then v_total := v_total + v_delivery.price; end if;
  if p_config->>'installation' = 'true' then v_total := v_total + v_installation.price; end if;
  if v_total > 2147483647 then raise exception 'total_overflow'; end if;
  v_estimate_id := gen_random_uuid();
  v_number := 'DC-' || to_char(now() at time zone 'UTC','YYYYMMDD') || '-' || upper(substr(replace(v_estimate_id::text,'-',''),1,10));
  v_snapshot := jsonb_build_object('model',v_model.name,'finish',v_finish.name,'size',v_size.label,'image',v_finish.image_path,'lines',v_lines,'total',v_total);
  insert into public.door_estimates(id, number, configuration, snapshot, total)
    values (v_estimate_id, v_number, p_config, v_snapshot, v_total::integer);
  insert into public.door_requests(estimate_id,customer_name,phone,email,comment,consent_at,ip_hash)
    values (v_estimate_id,v_name,v_phone,v_email,v_comment,now(),p_ip_hash) returning id into v_request_id;
  return jsonb_build_object('requestId',v_request_id,'estimateId',v_estimate_id,'number',v_number,'createdAt',now(),'snapshot',v_snapshot);
end $$;
revoke all on function public.create_door_request(jsonb,jsonb,text) from public, anon, authenticated;
grant execute on function public.create_door_request(jsonb,jsonb,text) to service_role;

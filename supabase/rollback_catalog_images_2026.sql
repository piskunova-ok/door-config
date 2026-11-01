-- Manual rollback only. Do not add this file to the migrations directory.
-- Keep /images/doors/*.webp deployed until this rollback is no longer needed.
begin;

create temporary table _door_image_rollback on commit drop as
select f.model_id, f.code,
  '/images/catalog-2026/' || m.asset_model_id || '__' || f.code || '__exterior.webp' as new_path,
  '/images/doors/' || m.asset_model_id || '__' || f.code || '.webp' as old_path
from public.door_models m
join public.door_finishes f on f.model_id = m.id
where (m.id, m.asset_model_id) in (
  ('axis', 'dc-02-minimal'), ('forma', 'dc-05-geo'),
  ('linea', 'dc-01-classic'), ('monolith', 'dc-04-stone'),
  ('atelier', 'dc-03-woodline')
);

do $$ begin
  if (select count(*) from _door_image_rollback) <> 20 or
     (select count(*) from _door_image_rollback s
      join public.door_finishes f on f.model_id = s.model_id and f.code = s.code
      where f.image_path in (s.old_path, s.new_path)) <> 20 then
    raise exception 'Image rollback preflight failed: expected 20 unchanged model/finish codes and known image paths.';
  end if;
end $$;

update public.door_finishes f set image_path = s.old_path
from _door_image_rollback s
where f.model_id = s.model_id and f.code = s.code and f.image_path = s.new_path;

do $$ begin
  if (select count(*) from _door_image_rollback s
      join public.door_finishes f on f.model_id = s.model_id and f.code = s.code
      where f.image_path = s.old_path) <> 20 then
    raise exception 'Image rollback verification failed: not all 20 old paths are present.';
  end if;
end $$;

commit;

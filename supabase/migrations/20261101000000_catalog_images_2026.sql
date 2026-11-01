-- Image-only migration. Existing model/finish codes, prices and RLS remain unchanged.
-- Apply only after the 25 files and compatible frontend have been deployed.
begin;
create temporary table _door_image_swap (
  model_id text not null, asset_model_id text not null, code text not null,
  old_path text not null, new_path text not null, primary key (model_id, code)
) on commit drop;
insert into _door_image_swap (model_id, asset_model_id, code, old_path, new_path) values
  ('axis','dc-02-minimal','avocado-matte','/images/doors/dc-02-minimal__avocado-matte.webp','/images/catalog-2026/dc-02-minimal__avocado-matte__exterior.webp'),
  ('axis','dc-02-minimal','graphite','/images/doors/dc-02-minimal__graphite.webp','/images/catalog-2026/dc-02-minimal__graphite__exterior.webp'),
  ('axis','dc-02-minimal','light-concrete','/images/doors/dc-02-minimal__light-concrete.webp','/images/catalog-2026/dc-02-minimal__light-concrete__exterior.webp'),
  ('axis','dc-02-minimal','natural-oak','/images/doors/dc-02-minimal__natural-oak.webp','/images/catalog-2026/dc-02-minimal__natural-oak__exterior.webp'),
  ('forma','dc-05-geo','ferro','/images/doors/dc-05-geo__ferro.webp','/images/catalog-2026/dc-05-geo__ferro__exterior.webp'),
  ('forma','dc-05-geo','gray-concrete','/images/doors/dc-05-geo__gray-concrete.webp','/images/catalog-2026/dc-05-geo__gray-concrete__exterior.webp'),
  ('forma','dc-05-geo','light-concrete','/images/doors/dc-05-geo__light-concrete.webp','/images/catalog-2026/dc-05-geo__light-concrete__exterior.webp'),
  ('forma','dc-05-geo','natural-oak','/images/doors/dc-05-geo__natural-oak.webp','/images/catalog-2026/dc-05-geo__natural-oak__exterior.webp'),
  ('linea','dc-01-classic','black-silk','/images/doors/dc-01-classic__black-silk.webp','/images/catalog-2026/dc-01-classic__black-silk__exterior.webp'),
  ('linea','dc-01-classic','dark-walnut','/images/doors/dc-01-classic__dark-walnut.webp','/images/catalog-2026/dc-01-classic__dark-walnut__exterior.webp'),
  ('linea','dc-01-classic','graphite-matte','/images/doors/dc-01-classic__graphite-matte.webp','/images/catalog-2026/dc-01-classic__graphite-matte__exterior.webp'),
  ('linea','dc-01-classic','white-oak','/images/doors/dc-01-classic__white-oak.webp','/images/catalog-2026/dc-01-classic__white-oak__exterior.webp'),
  ('monolith','dc-04-stone','graphite','/images/doors/dc-04-stone__graphite.webp','/images/catalog-2026/dc-04-stone__graphite__exterior.webp'),
  ('monolith','dc-04-stone','natural-oak','/images/doors/dc-04-stone__natural-oak.webp','/images/catalog-2026/dc-04-stone__natural-oak__exterior.webp'),
  ('monolith','dc-04-stone','nero-stone','/images/doors/dc-04-stone__nero-stone.webp','/images/catalog-2026/dc-04-stone__nero-stone__exterior.webp'),
  ('monolith','dc-04-stone','white-matte','/images/doors/dc-04-stone__white-matte.webp','/images/catalog-2026/dc-04-stone__white-matte__exterior.webp'),
  ('atelier','dc-03-woodline','black-silk','/images/doors/dc-03-woodline__black-silk.webp','/images/catalog-2026/dc-03-woodline__black-silk__exterior.webp'),
  ('atelier','dc-03-woodline','cream-matte','/images/doors/dc-03-woodline__cream-matte.webp','/images/catalog-2026/dc-03-woodline__cream-matte__exterior.webp'),
  ('atelier','dc-03-woodline','dark-walnut','/images/doors/dc-03-woodline__dark-walnut.webp','/images/catalog-2026/dc-03-woodline__dark-walnut__exterior.webp'),
  ('atelier','dc-03-woodline','gray-concrete','/images/doors/dc-03-woodline__gray-concrete.webp','/images/catalog-2026/dc-03-woodline__gray-concrete__exterior.webp');
do $$ begin
  if (select count(*) from _door_image_swap) <> 20 or (
    select count(*) from _door_image_swap s
    join public.door_models m on m.id = s.model_id and m.asset_model_id = s.asset_model_id
    join public.door_finishes f on f.model_id = m.id and f.code = s.code
    where f.image_path in (s.old_path, s.new_path)
  ) <> 20 then
    raise exception 'Image migration preflight failed: expected 20 matching finish rows with unchanged old or new paths.';
  end if;
end $$;
alter table public.door_finishes drop constraint if exists door_finishes_image_path_check;
alter table public.door_finishes add constraint door_finishes_image_path_check
  check (image_path ~ '^/images/(doors/[a-z0-9-]+__[a-z0-9-]+[.]webp|catalog-2026/[a-z0-9-]+__[a-z0-9-]+__exterior[.]webp)$');
update public.door_finishes f set image_path = s.new_path
from _door_image_swap s where f.model_id = s.model_id and f.code = s.code and f.image_path = s.old_path;
do $$ begin
  if (select count(*) from _door_image_swap s join public.door_finishes f
      on f.model_id = s.model_id and f.code = s.code and f.image_path = s.new_path) <> 20 then
    raise exception 'Image migration verification failed: not all 20 new paths are present.';
  end if;
end $$;
commit;

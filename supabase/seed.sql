-- Идемпотентное начальное заполнение. Повторный запуск не перезаписывает правки админа.
-- Все суммы условные и относятся только к демонстрационным моделям DOOR CONFIG.

insert into public.door_sizes (id, label, surcharge, sort_order) values
  ('860×2050', '860 × 2050 мм', 0, 1),
  ('960×2050', '960 × 2050 мм', 3200, 2),
  ('1000×2100', '1000 × 2100 мм', 6900, 3)
on conflict (id) do nothing;

insert into public.door_models
  (id, name, tagline, description, features, base_price, asset_model_id, sizes, is_visible, sort_order)
values
  ('axis', 'Axis', 'Чистая геометрия', 'Лаконичная входная дверь с точными линиями и спокойной геометрией.',
   array['Современный дизайн','Чистые линии','Для квартиры'], 42900, 'dc-02-minimal', array['860×2050','960×2050'], true, 1),
  ('forma', 'Forma', 'Архитектура деталей', 'Выразительный рисунок плоскостей для современного интерьера.',
   array['Геометрический рисунок','Мягкий контраст','Для квартиры'], 54900, 'dc-05-geo', array['860×2050','960×2050','1000×2100'], true, 2),
  ('linea', 'Linea', 'Тихая элегантность', 'Классические горизонтальные линии для светлых и уютных пространств.',
   array['Горизонтальный ритм','Современная классика','Для квартиры'], 64900, 'dc-01-classic', array['860×2050','960×2050'], true, 3),
  ('monolith', 'Monolith', 'Сила простоты', 'Монолитная плоскость с минеральной фактурой и тонким акцентом.',
   array['Цельный образ','Выразительная фактура','Для квартиры'], 97900, 'dc-04-stone', array['960×2050','1000×2100'], true, 4),
  ('atelier', 'Atelier', 'Тёплый характер', 'Древесная фактура и крупные ритмичные плоскости для камерного интерьера.',
   array['Акцентная текстура','Тёплая палитра','Для квартиры'], 124900, 'dc-03-woodline', array['860×2050','960×2050','1000×2100'], true, 5)
on conflict (id) do nothing;

insert into public.door_finishes
  (model_id, code, name, detail, tone, surcharge, image_path, is_visible, sort_order)
values
  ('axis','graphite','Графит','матовая поверхность','#454746',0,'/images/doors/dc-02-minimal__graphite.webp',true,1),
  ('axis','natural-oak','Натуральный дуб','древесная фактура','#b58a63',4200,'/images/doors/dc-02-minimal__natural-oak.webp',true,2),
  ('axis','light-concrete','Светлый бетон','минеральная текстура','#c7c5bb',5700,'/images/doors/dc-02-minimal__light-concrete.webp',true,3),
  ('axis','avocado-matte','Матовый авокадо','приглушённый зелёный','#777f73',6900,'/images/doors/dc-02-minimal__avocado-matte.webp',true,4),
  ('forma','ferro','Ферро','тёмный металл','#444746',0,'/images/doors/dc-05-geo__ferro.webp',true,1),
  ('forma','natural-oak','Натуральный дуб','тёплая древесина','#b88a60',4200,'/images/doors/dc-05-geo__natural-oak.webp',true,2),
  ('forma','light-concrete','Светлый бетон','светлая фактура','#d2cfc5',5700,'/images/doors/dc-05-geo__light-concrete.webp',true,3),
  ('forma','gray-concrete','Серый бетон','сдержанный серый','#888b88',6900,'/images/doors/dc-05-geo__gray-concrete.webp',true,4),
  ('linea','black-silk','Чёрный шёлк','тёмная поверхность','#303132',0,'/images/doors/dc-01-classic__black-silk.webp',true,1),
  ('linea','dark-walnut','Тёмный орех','тёплая древесина','#70513f',4200,'/images/doors/dc-01-classic__dark-walnut.webp',true,2),
  ('linea','white-oak','Белый дуб','светлая древесина','#dbd0bd',5700,'/images/doors/dc-01-classic__white-oak.webp',true,3),
  ('linea','graphite-matte','Матовый графит','глубокий серый','#5d5d5c',6900,'/images/doors/dc-01-classic__graphite-matte.webp',true,4),
  ('monolith','graphite','Графит','матовая поверхность','#565657',0,'/images/doors/dc-04-stone__graphite.webp',true,1),
  ('monolith','natural-oak','Натуральный дуб','тёплая древесина','#bd936c',4200,'/images/doors/dc-04-stone__natural-oak.webp',true,2),
  ('monolith','white-matte','Матовый белый','светлая поверхность','#e0dcd0',5700,'/images/doors/dc-04-stone__white-matte.webp',true,3),
  ('monolith','nero-stone','Камень неро','тёмная минеральная фактура','#414142',6900,'/images/doors/dc-04-stone__nero-stone.webp',true,4),
  ('atelier','black-silk','Чёрный шёлк','глубокий тёмный тон','#343537',0,'/images/doors/dc-03-woodline__black-silk.webp',true,1),
  ('atelier','dark-walnut','Тёмный орех','древесная фактура','#75513b',4200,'/images/doors/dc-03-woodline__dark-walnut.webp',true,2),
  ('atelier','cream-matte','Матовый крем','тёплый светлый тон','#dcd0b7',5700,'/images/doors/dc-03-woodline__cream-matte.webp',true,3),
  ('atelier','gray-concrete','Серый бетон','контрастная фактура','#90918e',6900,'/images/doors/dc-03-woodline__gray-concrete.webp',true,4)
on conflict (model_id, code) do nothing;

insert into public.door_accessories (id, name, price, is_visible, sort_order) values
  ('closer', 'Доводчик', 4800, true, 1),
  ('smartLock', 'Умный замок', 18900, true, 2),
  ('threshold', 'Усиленный порог', 3500, true, 3)
on conflict (id) do nothing;

insert into public.door_service_tariffs (id, price) values
  ('delivery', 3900),
  ('installation', 8500)
on conflict (id) do nothing;

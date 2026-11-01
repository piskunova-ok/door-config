// Сопоставление по asset_model_id и коду отделки подтверждено для действующего каталога.
// Имена моделей в новом manifest.json отличаются от действующего каталога; цены и коды не меняются.
const root = '/images/catalog-2026/'

export const imageManifest = {
  'dc-01-classic': {
    'black-silk': `${root}dc-01-classic__black-silk__exterior.webp`,
    'dark-walnut': `${root}dc-01-classic__dark-walnut__exterior.webp`,
    'graphite-matte': `${root}dc-01-classic__graphite-matte__exterior.webp`,
    'white-oak': `${root}dc-01-classic__white-oak__exterior.webp`,
  },
  'dc-02-minimal': {
    'avocado-matte': `${root}dc-02-minimal__avocado-matte__exterior.webp`,
    'graphite': `${root}dc-02-minimal__graphite__exterior.webp`,
    'light-concrete': `${root}dc-02-minimal__light-concrete__exterior.webp`,
    'natural-oak': `${root}dc-02-minimal__natural-oak__exterior.webp`,
  },
  'dc-03-woodline': {
    'black-silk': `${root}dc-03-woodline__black-silk__exterior.webp`,
    'cream-matte': `${root}dc-03-woodline__cream-matte__exterior.webp`,
    'dark-walnut': `${root}dc-03-woodline__dark-walnut__exterior.webp`,
    'gray-concrete': `${root}dc-03-woodline__gray-concrete__exterior.webp`,
  },
  'dc-04-stone': {
    'graphite': `${root}dc-04-stone__graphite__exterior.webp`,
    'natural-oak': `${root}dc-04-stone__natural-oak__exterior.webp`,
    'nero-stone': `${root}dc-04-stone__nero-stone__exterior.webp`,
    'white-matte': `${root}dc-04-stone__white-matte__exterior.webp`,
  },
  'dc-05-geo': {
    'ferro': `${root}dc-05-geo__ferro__exterior.webp`,
    'gray-concrete': `${root}dc-05-geo__gray-concrete__exterior.webp`,
    'light-concrete': `${root}dc-05-geo__light-concrete__exterior.webp`,
    'natural-oak': `${root}dc-05-geo__natural-oak__exterior.webp`,
  },
} as const

export const interiorImageManifest = {
  'dc-01-classic': `${root}dc-01-classic__interior.webp`,
  'dc-02-minimal': `${root}dc-02-minimal__interior.webp`,
  'dc-03-woodline': `${root}dc-03-woodline__interior.webp`,
  'dc-04-stone': `${root}dc-04-stone__interior.webp`,
  'dc-05-geo': `${root}dc-05-geo__interior.webp`,
} as const

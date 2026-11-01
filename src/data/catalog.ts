import { imageManifest } from './imageManifest.ts'

export type Finish = {
  id: string
  name: string
  detail: string
  tone: string
  accent: string
  demoSurcharge: number
  image: string
}

export type DoorModel = {
  id: string
  name: string
  tagline: string
  description: string
  features: string[]
  demoBasePrice: number
  assetModelId: keyof typeof imageManifest
  sizes: string[]
  finishes: Finish[]
}

type FinishSpec = [id: string, name: string, detail: string, tone: string, demoSurcharge: number]

// Связь идентификаторов и WebP взята из manifest.json. Тарифы ниже условные.
const finishes = (assetModelId: keyof typeof imageManifest, specs: FinishSpec[]): Finish[] =>
  specs.map(([id, name, detail, tone, demoSurcharge]) => {
    const image = (imageManifest[assetModelId] as Record<string, string>)[id]
    if (!image) throw new Error(`Нет изображения отделки ${assetModelId}/${id}`)
    return { id, name, detail, tone, accent: tone, demoSurcharge, image }
  })

export const models: DoorModel[] = [
  {
    id: 'axis', name: 'Axis', tagline: 'Чистая геометрия',
    description: 'Лаконичная входная дверь с точными линиями и спокойной геометрией.',
    features: ['Современный дизайн', 'Чистые линии', 'Для квартиры'],
    demoBasePrice: 42900, assetModelId: 'dc-02-minimal', sizes: ['860×2050', '960×2050'],
    finishes: finishes('dc-02-minimal', [
      ['graphite', 'Графит', 'матовая поверхность', '#454746', 0],
      ['natural-oak', 'Натуральный дуб', 'древесная фактура', '#b58a63', 4200],
      ['light-concrete', 'Светлый бетон', 'минеральная текстура', '#c7c5bb', 5700],
      ['avocado-matte', 'Матовый авокадо', 'приглушённый зелёный', '#777f73', 6900],
    ]),
  },
  {
    id: 'forma', name: 'Forma', tagline: 'Архитектура деталей',
    description: 'Выразительный рисунок плоскостей для современного интерьера.',
    features: ['Геометрический рисунок', 'Мягкий контраст', 'Для квартиры'],
    demoBasePrice: 54900, assetModelId: 'dc-05-geo', sizes: ['860×2050', '960×2050', '1000×2100'],
    finishes: finishes('dc-05-geo', [
      ['ferro', 'Ферро', 'тёмный металл', '#444746', 0],
      ['natural-oak', 'Натуральный дуб', 'тёплая древесина', '#b88a60', 4200],
      ['light-concrete', 'Светлый бетон', 'светлая фактура', '#d2cfc5', 5700],
      ['gray-concrete', 'Серый бетон', 'сдержанный серый', '#888b88', 6900],
    ]),
  },
  {
    id: 'linea', name: 'Linea', tagline: 'Тихая элегантность',
    description: 'Классические горизонтальные линии для светлых и уютных пространств.',
    features: ['Горизонтальный ритм', 'Современная классика', 'Для квартиры'],
    demoBasePrice: 64900, assetModelId: 'dc-01-classic', sizes: ['860×2050', '960×2050'],
    finishes: finishes('dc-01-classic', [
      ['black-silk', 'Чёрный шёлк', 'тёмная поверхность', '#303132', 0],
      ['dark-walnut', 'Тёмный орех', 'тёплая древесина', '#70513f', 4200],
      ['white-oak', 'Белый дуб', 'светлая древесина', '#dbd0bd', 5700],
      ['graphite-matte', 'Матовый графит', 'глубокий серый', '#5d5d5c', 6900],
    ]),
  },
  {
    id: 'monolith', name: 'Monolith', tagline: 'Сила простоты',
    description: 'Монолитная плоскость с минеральной фактурой и тонким акцентом.',
    features: ['Цельный образ', 'Выразительная фактура', 'Для квартиры'],
    demoBasePrice: 97900, assetModelId: 'dc-04-stone', sizes: ['960×2050', '1000×2100'],
    finishes: finishes('dc-04-stone', [
      ['graphite', 'Графит', 'матовая поверхность', '#565657', 0],
      ['natural-oak', 'Натуральный дуб', 'тёплая древесина', '#bd936c', 4200],
      ['white-matte', 'Матовый белый', 'светлая поверхность', '#e0dcd0', 5700],
      ['nero-stone', 'Камень неро', 'тёмная минеральная фактура', '#414142', 6900],
    ]),
  },
  {
    id: 'atelier', name: 'Atelier', tagline: 'Тёплый характер',
    description: 'Древесная фактура и крупные ритмичные плоскости для камерного интерьера.',
    features: ['Акцентная текстура', 'Тёплая палитра', 'Для квартиры'],
    demoBasePrice: 124900, assetModelId: 'dc-03-woodline', sizes: ['860×2050', '960×2050', '1000×2100'],
    finishes: finishes('dc-03-woodline', [
      ['black-silk', 'Чёрный шёлк', 'глубокий тёмный тон', '#343537', 0],
      ['dark-walnut', 'Тёмный орех', 'древесная фактура', '#75513b', 4200],
      ['cream-matte', 'Матовый крем', 'тёплый светлый тон', '#dcd0b7', 5700],
      ['gray-concrete', 'Серый бетон', 'контрастная фактура', '#90918e', 6900],
    ]),
  },
]

export const sizes = [
  { id: '860×2050', label: '860 × 2050 мм', demoSurcharge: 0 },
  { id: '960×2050', label: '960 × 2050 мм', demoSurcharge: 3200 },
  { id: '1000×2100', label: '1000 × 2100 мм', demoSurcharge: 6900 },
] as const

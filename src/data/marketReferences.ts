// Цены «от» из door_config_real_prices_2026-10-27.xlsx, Москва, 27.10.2026.
// Они относятся к указанным карточкам Torex, а не к моделям DOOR CONFIG.
export type MarketReference = {
  series: string
  article: string
  publishedFrom: number
  externalFinish: string
  internalFinish: string
  sourceUrl: string
  checkedOn: string
}

export const marketReferences: Record<string, MarketReference> = {
  axis: {
    series: 'DELTA PRO MP', article: '689961', publishedFrom: 40265,
    externalFinish: 'Черный шелк', internalFinish: 'ПВХ Оскуро',
    sourceUrl: 'https://torex.ru/catalog/product/689961/', checkedOn: '27.10.2026',
  },
  forma: {
    series: 'TAU PRO PP', article: '4427473', publishedFrom: 51995,
    externalFinish: 'ПВХ Авокадо', internalFinish: 'ПВХ Бьянко',
    sourceUrl: 'https://torex.ru/catalog/product/4427473/', checkedOn: '27.10.2026',
  },
  linea: {
    series: 'S.OMEGA PRO MP', article: '3611445', publishedFrom: 61400,
    externalFinish: 'Колоре Неро', internalFinish: 'ПВХ Крема',
    sourceUrl: 'https://torex.ru/catalog/product/3611445/', checkedOn: '27.10.2026',
  },
  monolith: {
    series: 'ULTIMATUM PRO MP', article: '3509572', publishedFrom: 94530,
    externalFinish: 'Колоре бьянко', internalFinish: 'ПВХ Ферро',
    sourceUrl: 'https://torex.ru/catalog/product/3509572/', checkedOn: '27.10.2026',
  },
  atelier: {
    series: 'ULTIMATUM NEXT', article: '590743', publishedFrom: 118900,
    externalFinish: 'ПВХ Черная шагрень', internalFinish: 'ПВХ Крема',
    sourceUrl: 'https://torex.ru/catalog/product/590743/', checkedOn: '27.10.2026',
  },
}

export const marketServiceReferences = {
  deliveryMoscow: { amount: 3500, sourceUrl: 'https://torex.ru/catalog/product/689961/' },
  installationDelta: { amount: 5450, sourceUrl: 'https://torex.ru/catalog/product/689961/' },
  installationNext: { amount: 7000, sourceUrl: 'https://torex.ru/catalog/product/867910/' },
} as const

import { localDemoCatalog } from '../data/catalogData.ts'
import type { CatalogData } from '../data/catalogData.ts'

export type Configuration = {
  modelId: string | null
  finishId: string | null
  sizeId: string | null
  accessoryIds: string[]
  delivery: boolean | null
  installation: boolean | null
}

export type EstimateLine = { key: string; label: string; amount: number }
export type Estimate = {
  valid: boolean
  errors: string[]
  lines: EstimateLine[]
  total: number | null
  modelName?: string
  finishName?: string
  sizeName?: string
  image?: string
}

export const emptyConfiguration: Configuration = {
  modelId: null, finishId: null, sizeId: null,
  accessoryIds: [], delivery: null, installation: null,
}

const validAmount = (value: number) => Number.isFinite(value) && value >= 0

export function calculateEstimate(config: Configuration, catalog: CatalogData = localDemoCatalog): Estimate {
  const errors: string[] = []
  const model = catalog.models.find(item => item.id === config.modelId)
  const finish = model?.finishes.find(item => item.id === config.finishId)
  const size = catalog.sizes.find(item => item.id === config.sizeId && model?.sizes.includes(item.id))

  if (!model) errors.push('Выберите модель двери')
  if (!finish) errors.push('Выберите отделку')
  if (!size) errors.push('Выберите доступный размер')
  if (config.delivery === null) errors.push('Укажите, нужна ли доставка')
  if (config.installation === null) errors.push('Укажите, нужен ли монтаж')

  const distinctIds = new Set(config.accessoryIds)
  const accessories = [...distinctIds].map(id => catalog.accessories.find(item => item.id === id))
  if (accessories.some(item => !item)) errors.push('Выбрана неизвестная опция')
  if (model && !validAmount(model.demoBasePrice)) errors.push('Некорректная базовая стоимость')
  if (finish && !validAmount(finish.demoSurcharge)) errors.push('Некорректная стоимость отделки')
  if (size && !validAmount(size.demoSurcharge)) errors.push('Некорректная стоимость размера')
  if (accessories.some(item => item && !validAmount(item.price))) errors.push('Некорректная стоимость комплектующего')
  if (!validAmount(catalog.delivery) || !validAmount(catalog.installation)) errors.push('Некорректный тариф услуги')

  if (errors.length || !model || !finish || !size) {
    return { valid: false, errors, lines: [], total: null }
  }

  const lines: EstimateLine[] = [
    { key: 'base', label: `Дверь ${model.name} — базовая стоимость`, amount: model.demoBasePrice },
    { key: 'finish', label: `Отделка — ${finish.name}`, amount: finish.demoSurcharge },
    { key: 'size', label: `Размер — ${size.label}`, amount: size.demoSurcharge },
    ...accessories.filter(item => item !== undefined).map(item => ({ key: item.id, label: item.name, amount: item.price })),
    { key: 'delivery', label: `Доставка — ${config.delivery ? 'требуется' : 'не требуется'}`, amount: config.delivery ? catalog.delivery : 0 },
    { key: 'installation', label: `Монтаж — ${config.installation ? 'требуется' : 'не требуется'}`, amount: config.installation ? catalog.installation : 0 },
  ]
  const total = lines.reduce((sum, line) => sum + line.amount, 0)
  if (!validAmount(total) || !Number.isSafeInteger(total)) {
    return { valid: false, errors: ['Некорректная итоговая сумма'], lines: [], total: null }
  }
  return { valid: true, errors: [], lines, total, modelName: model.name, finishName: finish.name, sizeName: size.label, image: finish.image }
}

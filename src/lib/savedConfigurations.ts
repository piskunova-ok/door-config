import type { Configuration } from './pricing.ts'

export const slots = [1, 2, 3] as const
export type Slot = typeof slots[number]
export type Variant = { slot: Slot; modelName: string; config: Configuration }
type Store = { raw: string | null; variants: Variant[]; warning: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isVariant(value: unknown): value is Variant {
  if (!isRecord(value) || !slots.some(slot => slot === value.slot) || !isId(value.modelName)) return false
  const config = value.config
  return isRecord(config) && isId(config.modelId) && isId(config.finishId) && isId(config.sizeId)
    && Array.isArray(config.accessoryIds) && config.accessoryIds.every(isId)
    && typeof config.delivery === 'boolean' && typeof config.installation === 'boolean'
}

export function readVariants(key: string): Store {
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(key)
    if (raw === null) return { raw, variants: [], warning: '' }
    const data: unknown = JSON.parse(raw)
    if (!isRecord(data) || data.version !== 1 || !Array.isArray(data.variants)) throw new Error()
    const variants: Variant[] = []
    for (const item of data.variants) {
      if (isVariant(item) && !variants.some(v => v.slot === item.slot)) variants.push(item)
    }
    return { raw, variants, warning: variants.length === data.variants.length ? '' : 'Некоторые сохранённые записи повреждены.' }
  } catch {
    return { raw, variants: [], warning: 'Не удалось прочитать сохранённые варианты в этом браузере.' }
  }
}

export function writeVariants(key: string, previous: Store, variants: Variant[]): Store {
  if (window.localStorage.getItem(key) !== previous.raw) {
    throw new Error('Варианты изменились в другой вкладке. Проверьте список и повторите действие.')
  }
  const raw = JSON.stringify({ version: 1, variants })
  window.localStorage.setItem(key, raw)
  return { raw, variants, warning: '' }
}

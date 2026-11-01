import { imageManifest } from '../data/imageManifest.ts'
import type { CatalogData } from '../data/catalogData.ts'
import type { DoorModel, Finish } from '../data/catalog.ts'
import type { AccessoryRow, FinishRow, ModelRow, ServiceRow, SizeRow } from './database.types.ts'
import { supabase } from './supabase.ts'
export type { AccessoryRow, FinishRow, ModelRow, ServiceRow, SizeRow } from './database.types.ts'

export type CatalogRows = {
  models: ModelRow[]
  finishes: FinishRow[]
  sizes: SizeRow[]
  accessories: AccessoryRow[]
  services: ServiceRow[]
}

const moneyIsValid = (value: number) => Number.isSafeInteger(value) && value >= 0

export async function loadCatalogRows(publicOnly: boolean): Promise<CatalogRows> {
  if (!supabase) throw new Error('Supabase не настроен.')
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 12000)
  let modelsQuery = supabase.from('door_models').select('*').order('sort_order')
  let finishesQuery = supabase.from('door_finishes').select('*').order('sort_order')
  let accessoriesQuery = supabase.from('door_accessories').select('*').order('sort_order')
  if (publicOnly) {
    modelsQuery = modelsQuery.eq('is_visible', true)
    finishesQuery = finishesQuery.eq('is_visible', true)
    accessoriesQuery = accessoriesQuery.eq('is_visible', true)
  }
  try {
    const [modelResult, finishResult, sizeResult, accessoryResult, serviceResult] = await Promise.all([
      modelsQuery.abortSignal(controller.signal),
      finishesQuery.abortSignal(controller.signal),
      supabase.from('door_sizes').select('*').order('sort_order').abortSignal(controller.signal),
      accessoriesQuery.abortSignal(controller.signal),
      supabase.from('door_service_tariffs').select('*').abortSignal(controller.signal),
    ])
    for (const result of [modelResult, finishResult, sizeResult, accessoryResult, serviceResult]) {
      if (result.error) throw new Error(result.error.message)
    }
    return {
      models: modelResult.data ?? [],
      finishes: finishResult.data ?? [],
      sizes: sizeResult.data ?? [],
      accessories: accessoryResult.data ?? [],
      services: serviceResult.data ?? [],
    }
  } catch (error) {
    if (controller.signal.aborted) throw new Error('Supabase не ответил за 12 секунд. Повторите загрузку каталога.')
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}

export function toPublicCatalog(rows: CatalogRows): CatalogData {
  const previewImages = import.meta.env.DEV && new URLSearchParams(window.location.search).get('previewImages') === '1'
  const sizes = rows.sizes.map(row => ({ id: row.id, label: row.label, demoSurcharge: row.surcharge }))
  const knownSizeIds = new Set(sizes.map(size => size.id))
  const services = new Map(rows.services.map(row => [row.id, row.price]))
  const delivery = services.get('delivery')
  const installation = services.get('installation')
  if (!moneyIsValid(delivery ?? NaN) || !moneyIsValid(installation ?? NaN)) {
    throw new Error('В каталоге отсутствует корректный тариф доставки или монтажа.')
  }
  if (rows.sizes.some(row => !moneyIsValid(row.surcharge)) || rows.accessories.some(row => !moneyIsValid(row.price))) {
    throw new Error('В каталоге обнаружен некорректный тариф.')
  }
  const models: DoorModel[] = rows.models.filter(row => row.is_visible).map(row => {
    if (!(row.asset_model_id in imageManifest) || !moneyIsValid(row.base_price)) {
      throw new Error(`Некорректные данные модели ${row.id}.`)
    }
    const group = imageManifest[row.asset_model_id] as Record<string, string>
    const groupImages = new Set([
      ...Object.values(group),
      ...Object.keys(group).map(code => `/images/doors/${row.asset_model_id}__${code}.webp`),
    ])
    const finishes: Finish[] = rows.finishes
      .filter(finish => finish.model_id === row.id && finish.is_visible)
      .map(finish => {
        if (!groupImages.has(finish.image_path) || !moneyIsValid(finish.surcharge)) {
          throw new Error(`Некорректные данные отделки ${row.id}/${finish.code}.`)
        }
        return {
          id: finish.code,
          name: finish.name,
          detail: finish.detail,
          tone: finish.tone,
          accent: finish.tone,
          demoSurcharge: finish.surcharge,
          image: previewImages && finish.image_path === `/images/doors/${row.asset_model_id}__${finish.code}.webp`
            ? group[finish.code] ?? finish.image_path
            : finish.image_path,
        }
      })
    return {
      id: row.id,
      name: row.name,
      tagline: row.tagline,
      description: row.description,
      features: row.features,
      demoBasePrice: row.base_price,
      assetModelId: row.asset_model_id,
      sizes: row.sizes.filter(id => knownSizeIds.has(id)),
      finishes,
    }
  }).filter(model => model.finishes.length > 0 && model.sizes.length > 0)
  if (!models.length) throw new Error('В каталоге нет опубликованных моделей с отделкой и размером.')
  return {
    models,
    sizes,
    accessories: rows.accessories.filter(row => row.is_visible).map(row => ({ id: row.id, name: row.name, price: row.price })),
    delivery: delivery!,
    installation: installation!,
  }
}

export async function loadPublicCatalog(): Promise<CatalogData> {
  return toPublicCatalog(await loadCatalogRows(true))
}

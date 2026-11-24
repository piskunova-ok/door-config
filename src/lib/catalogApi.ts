import type { CatalogData } from '../data/catalogData.ts'
import { mapPublicCatalog, type CatalogRows } from './publicCatalog.ts'
export type { CatalogRows } from './publicCatalog.ts'
import { supabase } from './supabase.ts'
export type { AccessoryRow, FinishRow, ModelRow, ServiceRow, SizeRow } from './database.types.ts'

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

export function toPublicCatalog(rows: CatalogRows) {
  const previewImages = import.meta.env.DEV && new URLSearchParams(window.location.search).get('previewImages') === '1'
  return mapPublicCatalog(rows, previewImages)
}

export async function loadPublicCatalog(): Promise<CatalogData> {
  return toPublicCatalog(await loadCatalogRows(true))
}

import { models, sizes } from './catalog.ts'
import type { DoorModel } from './catalog.ts'
import { demoTariffs } from './demoTariffs.ts'

export type SizeOption = { id: string; label: string; demoSurcharge: number }
export type AccessoryOption = { id: string; name: string; price: number }

export type CatalogData = {
  models: DoorModel[]
  sizes: SizeOption[]
  accessories: AccessoryOption[]
  delivery: number
  installation: number
}

// Явный локальный деморежим до подключения отдельного проекта Supabase.
// После настройки базы этот объект никогда не используется как скрытый fallback.
export const localDemoCatalog: CatalogData = {
  models,
  sizes: [...sizes],
  accessories: demoTariffs.accessories.map(item => ({ ...item })),
  delivery: demoTariffs.delivery,
  installation: demoTariffs.installation,
}

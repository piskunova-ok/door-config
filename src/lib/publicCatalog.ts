import { imageManifest } from '../data/imageManifest.ts'
import type { CatalogData } from '../data/catalogData.ts'
import type { DoorModel, Finish } from '../data/catalog.ts'
import type { AccessoryRow, FinishRow, ModelRow, ServiceRow, SizeRow } from './database.types.ts'

export type CatalogRows = {
  models: ModelRow[]
  finishes: FinishRow[]
  sizes: SizeRow[]
  accessories: AccessoryRow[]
  services: ServiceRow[]
}

const moneyIsValid = (value: number) => Number.isSafeInteger(value) && value >= 0

export function mapPublicCatalog(rows: CatalogRows, previewImages = false): CatalogData {
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

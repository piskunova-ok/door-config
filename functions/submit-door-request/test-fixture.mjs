// Synthetic catalog and contacts for offline tests only.
export const origin = 'https://door.example'
export const env = {
  DOOR_REQUESTS_ENABLED: 'true', SITE_ORIGINS: origin,
  SUPABASE_URL: 'https://catalog-test.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fixture',
  POSTBOX_FROM: 'sender@example.invalid', POSTBOX_TO: 'manager@example.invalid',
}
export function catalogTables() {
  return {
    door_models: [{ id: 'axis', name: 'Axis', base_price: 44000, is_visible: true, features: [],
      asset_model_id: 'dc-02-minimal', sizes: ['860×2050'], tagline: 'Axis', description: 'Тест' }],
    door_finishes: [{ model_id: 'axis', code: 'graphite', name: 'Графит', surcharge: 2000, is_visible: true,
      tone: '#444444', image_path: '/images/catalog-2026/dc-02-minimal__graphite__exterior.webp' }],
    door_sizes: [{ id: '860×2050', label: '860 × 2050 мм', surcharge: 500 }],
    door_accessories: [{ id: 'eye', name: 'Дверной глазок', price: 1000, is_visible: true }],
    door_service_tariffs: [{ id: 'delivery', price: 3500 }, { id: 'installation', price: 4000 }],
  }
}
export function submission() {
  return {
    contact: { name: 'Учебный пример', phone: '+7 (000) 000-00-00', email: '', comment: '', consent: true },
    configuration: { modelId: 'axis', finishId: 'graphite', sizeId: '860×2050', accessoryIds: ['eye'], delivery: true, installation: false },
    website: '', startedAt: Date.now() - 10000,
    quote: { total: 51000, lines: [
      ['base', 44000], ['finish', 2000], ['size', 500], ['eye', 1000], ['delivery', 3500], ['installation', 0],
    ].map(([key, amount]) => ({ key, amount })) },
  }
}
export function eventFor(body = submission()) {
  return { httpMethod: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}

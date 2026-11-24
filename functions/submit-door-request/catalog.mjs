import { mapPublicCatalog } from '../../src/lib/publicCatalog.ts'

const tables = [
  ['models', 'door_models', true],
  ['finishes', 'door_finishes', true],
  ['sizes', 'door_sizes', false],
  ['accessories', 'door_accessories', true],
  ['services', 'door_service_tariffs', false],
]

export async function readCatalog(env, fetchImpl) {
  const url = new URL(env.SUPABASE_URL)
  const key = env.SUPABASE_PUBLISHABLE_KEY ?? ''
  const headers = { apikey: key }
  if (!key.startsWith('sb_publishable_')) {
    const claims = JSON.parse(Buffer.from(key.split('.')[1] ?? '', 'base64url').toString())
    if (claims.role !== 'anon' || key.split('.').length !== 3) throw Error('Public key required')
    headers.authorization = 'Bearer ' + key
  }
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.supabase.co') || url.origin + '/' !== url.href) {
    throw Error('Invalid catalog URL')
  }
  const signal = AbortSignal.timeout(9000)
  const rows = await Promise.all(tables.map(async ([name, table, visibleOnly]) => {
    const endpoint = new URL('/rest/v1/' + table, url)
    endpoint.searchParams.set('select', '*')
    if (visibleOnly) endpoint.searchParams.set('is_visible', 'eq.true')
    if (name !== 'services') endpoint.searchParams.set('order', 'sort_order.asc')
    const result = await fetchImpl(endpoint, { headers, signal, redirect: 'error' })
    if (!result.ok) throw Error('Catalog unavailable')
    return [name, await result.json()]
  }))
  return mapPublicCatalog(Object.fromEntries(rows))
}

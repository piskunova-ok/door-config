import { mapPublicCatalog } from '../../src/lib/publicCatalog.ts'

const tables = [
  ['models', 'door_models', true],
  ['finishes', 'door_finishes', true],
  ['sizes', 'door_sizes', false],
  ['accessories', 'door_accessories', true],
  ['services', 'door_service_tariffs', false],
]

const codes = {
  url: 'CATALOG_CONFIG', key: 'CATALOG_CONFIG', http: 'CATALOG_HTTP',
  timeout: 'CATALOG_TIMEOUT', network: 'CATALOG_NETWORK',
  response: 'CATALOG_MAPPING', mapping: 'CATALOG_MAPPING',
}

// Only these locally assigned fields are suitable for Cloud Logging.
export class CatalogError extends Error {
  constructor(stage, table, status) {
    super('Catalog unavailable')
    this.code = codes[stage] ?? 'CATALOG_UNKNOWN'
    this.diagnostic = { stage, table, status }
  }
}

export async function readCatalog(env, fetchImpl) {
  let url
  try { url = new URL(env.SUPABASE_URL) } catch { throw new CatalogError('url') }
  const key = env.SUPABASE_PUBLISHABLE_KEY ?? ''
  const headers = { apikey: key }
  if (key.startsWith('sb_publishable_')) {
    if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) throw new CatalogError('key')
  } else {
    if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(key)) throw new CatalogError('key')
    let claims
    try { claims = JSON.parse(Buffer.from(key.split('.')[1] ?? '', 'base64url').toString()) } catch { throw new CatalogError('key') }
    if (claims?.role !== 'anon') throw new CatalogError('key')
    headers.authorization = 'Bearer ' + key
  }
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.supabase.co') || url.origin + '/' !== url.href) {
    throw new CatalogError('url')
  }
  const started = performance.now()
  const elapsed = () => Math.round(performance.now() - started)
  const progress = tables.map(([, table]) => ({ table, state: 'queued' }))
  const signal = AbortSignal.timeout(15000)
  const timeoutError = () => {
    const error = new CatalogError('timeout')
    error.timing = { elapsedMs: elapsed(), tables: progress.map(entry => ({ ...entry })) }
    return error
  }
  let onTimeout
  const deadline = new Promise((_, reject) => {
    onTimeout = () => reject(timeoutError())
    signal.addEventListener('abort', onTimeout, { once: true })
  })
  async function readTable([name, table, visibleOnly], entry) {
    const endpoint = new URL('/rest/v1/' + table, url)
    endpoint.searchParams.set('select', '*')
    if (visibleOnly) endpoint.searchParams.set('is_visible', 'eq.true')
    if (name !== 'services') endpoint.searchParams.set('order', 'sort_order.asc')
    entry.state = 'waiting_headers'
    entry.startedMs = elapsed()
    let result
    try { result = await fetchImpl(endpoint, { headers, signal, redirect: 'error' }) } catch {
      if (signal.aborted) throw timeoutError()
      throw new CatalogError('network', table)
    }
    entry.headersMs = elapsed()
    entry.state = 'reading_body'
    if (!result.ok) throw new CatalogError('http', table, result.status)
    try {
      const data = await result.json()
      entry.completedMs = elapsed()
      entry.state = 'complete'
      return [name, data]
    } catch (error) {
      if (signal.aborted) throw timeoutError()
      throw new CatalogError(error instanceof SyntaxError ? 'response' : 'network', table)
    }
  }
  const rows = []
  try {
    for (const [index, table] of tables.entries()) {
      if (signal.aborted) throw timeoutError()
      rows.push(await Promise.race([readTable(table, progress[index]), deadline]))
    }
  } finally {
    signal.removeEventListener('abort', onTimeout)
  }
  try { return mapPublicCatalog(Object.fromEntries(rows)) } catch { throw new CatalogError('mapping') }
}

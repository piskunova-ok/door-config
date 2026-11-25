import { constructionSummary, interiorColor, modelSpec } from '../../src/data/doorSpecs.ts'
import { createHmac, randomBytes, randomUUID } from 'node:crypto'
import { calculateEstimate } from '../../src/lib/pricing.ts'
import { CatalogError, readCatalog } from './catalog.mjs'
import { createEstimatePdf } from './pdf.mjs'
import { sendEstimate } from './postbox.mjs'
import { matchesQuote, validSubmission } from './validation.mjs'

const maxBytes = 16 * 1024
const unavailable = 'Приём заявок временно недоступен.'

// Best effort within one warm instance. Never forward client IP or request headers to the catalog.
function instanceLimiter() {
  const salt = randomBytes(32)
  const attempts = new Map()
  return (sourceIp, now) => {
    for (const [key, entry] of attempts) if (entry.until <= now) attempts.delete(key)
    const key = createHmac('sha256', salt).update(sourceIp || 'unknown').digest('hex')
    const entry = attempts.get(key)
    if (entry) return ++entry.count <= 8
    if (attempts.size >= 2048) return false
    attempts.set(key, { count: 1, until: now + 60000 })
    return true
  }
}

export function createHandler({ env = process.env, fetchImpl = fetch, render = createEstimatePdf } = {}) {
  const allowAttempt = instanceLimiter()
  return async (event, context) => {
    const headers = Object.fromEntries(Object.entries(event.headers ?? {}).map(([key, value]) => [key.toLowerCase(), value]))
    const responseHeaders = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', Vary: 'Origin' }
    const reply = (statusCode, data) => ({ statusCode, headers: responseHeaders, body: data ? JSON.stringify(data) : '' })
    const fail = (status, error) => reply(status, { error })
    const allowed = (env.SITE_ORIGINS || '').split(',').map(origin => origin.trim()).filter(Boolean)
    if (!headers.origin || !allowed.includes(headers.origin)) return fail(403, 'Источник запроса не разрешён.')
    responseHeaders['Access-Control-Allow-Origin'] = headers.origin
    if (event.httpMethod === 'OPTIONS') {
      responseHeaders['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
      responseHeaders['Access-Control-Allow-Headers'] = 'Content-Type'
      return reply(204)
    }
    if (event.httpMethod !== 'POST') return fail(405, 'Требуется POST.')
    if (env.DOOR_REQUESTS_ENABLED !== 'true') return fail(503, unavailable)
    if (headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') return fail(415, 'Требуется JSON.')
    const now = Date.now()
    if (!allowAttempt(event.requestContext?.identity?.sourceIp, now)) return fail(429, 'Слишком много попыток. Подождите минуту.')
    if (typeof event.body !== 'string') return fail(400, 'Отсутствует тело запроса.')
    const encodedLimit = event.isBase64Encoded ? Math.ceil(maxBytes / 3) * 4 : maxBytes
    if (event.body.length > encodedLimit) return fail(413, 'Слишком большой запрос.')
    const bytes = Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf8')
    if (bytes.length > maxBytes) return fail(413, 'Слишком большой запрос.')
    let body
    try { body = JSON.parse(bytes.toString('utf8')) } catch { return fail(400, 'Некорректный JSON.') }
    if (!validSubmission(body, now)) return fail(400, 'Проверьте комплектацию, контакты и согласие на обработку данных.')
    const token = context?.token?.access_token
    if (!token || !env.POSTBOX_FROM || !env.POSTBOX_TO) return fail(503, unavailable)
    let catalog
    try {
      catalog = await readCatalog(env, fetchImpl)
    } catch (error) {
      console.error('catalog_read_failed', error instanceof CatalogError ? error.diagnostic : { stage: 'unknown' })
      return reply(503, { ...(error instanceof CatalogError && error.timing ? { timing: error.timing } : {}), code: error instanceof CatalogError ? error.code : 'CATALOG_UNKNOWN', error: 'Не удалось проверить тарифы. Заявка не отправлена.' })
    }
    const estimate = calculateEstimate(body.configuration, catalog)
    if (!estimate.valid) return fail(422, 'Выбранные параметры недоступны. Проверьте комплектацию по актуальному каталогу.')
    const spec = modelSpec(body.configuration.modelId)
    const snapshot = {
      interior: interiorColor(body.configuration.modelId, body.configuration.interiorId)?.name ?? 'Не выбран',
      construction: spec ? constructionSummary(spec) : '',
      model: estimate.modelName, finish: estimate.finishName, size: estimate.sizeName, image: estimate.image,
      accessories: body.configuration.accessoryIds.map(id => catalog.accessories.find(item => item.id === id).name),
      lines: estimate.lines, total: estimate.total,
    }
    if (!matchesQuote(body.quote, estimate)) return reply(409, { code: 'price_changed', snapshot })
    const createdAt = new Date(now).toISOString()
    const number = 'DC-' + createdAt.slice(0, 10).replaceAll('-', '') + '-' + randomUUID().slice(0, 13).toUpperCase()
    const receipt = { createdAt, number, snapshot }
    let pdf
    try { pdf = await render(receipt) } catch { return fail(503, 'Не удалось подготовить PDF. Заявка не отправлена.') }
    try {
      await sendEstimate({ token, env, contact: body.contact, receipt, pdf, fetchImpl })
    } catch {
      return fail(502, 'Почтовый сервис не подтвердил приём заявки ' + number + '. Автоматического повтора не будет.')
    }
    return reply(200, receipt)
  }
}

export const handler = createHandler()

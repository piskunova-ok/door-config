import test from 'node:test'
import assert from 'node:assert/strict'
import { createHandler } from './handler.mjs'
import { catalogTables, env, eventFor, submission } from './test-fixture.mjs'

function fixture(settings = {}, options = {}) {
  const tables = catalogTables()
  const catalogRequests = []
  const letters = []
  const fetchImpl = async (url, init) => {
    const address = new URL(url)
    if (address.origin === env.SUPABASE_URL) {
      catalogRequests.push({ address, init })
      if (options.catalogFailure) throw Error('sensitive upstream text')
      const table = address.pathname.split('/').pop()
      assert.ok(Object.hasOwn(tables, table))
      return Response.json(tables[table])
    }
    assert.equal(address.href, 'https://postbox.cloud.yandex.net/v2/email/outbound-emails')
    assert.equal(init.headers['X-YaCloud-SubjectToken'], 'fixture-token')
    letters.push(JSON.parse(init.body))
    if (options.mailFailure) throw Error('sensitive upstream text')
    return Response.json({ MessageId: 'test-accepted' })
  }
  const handler = createHandler({ env: { ...env, ...settings }, fetchImpl, render: options.render })
  return { invoke: event => handler(event, { token: { access_token: 'fixture-token' } }), tables, catalogRequests, letters }
}

test('closed by default; preflight only for allowed origin; no downstream requests', async () => {
  for (const flag of [undefined, 'false', 'TRUE']) {
    const f = fixture({ DOOR_REQUESTS_ENABLED: flag })
    const event = eventFor()
    assert.equal((await f.invoke({ ...event, httpMethod: 'OPTIONS' })).statusCode, 204)
    assert.equal((await f.invoke({ ...event, headers: { Origin: 'https://other.invalid' } })).statusCode, 403)
    assert.equal((await f.invoke({ ...event, body: 'broken' })).statusCode, 503)
    assert.equal(f.catalogRequests.length + f.letters.length, 0)
  }
})

test('rejects malformed, oversized, automated and invalid submissions before catalog access', async () => {
  for (const change of [b => { b.contact.consent = false }, b => { b.contact.phone = '-------' },
    b => { b.contact.email = 'bad@' }, b => { b.contact.name = ' ' }, b => { b.contact.comment = 'a'.repeat(2001) },
    b => { b.website = 'bot' }, b => { b.startedAt = Date.now() }, b => { b.quote.total = -1 },
    b => { b.configuration.delivery = 'yes' }, b => { b.configuration.accessoryIds = ['eye', 'eye'] }]) {
    const f = fixture()
    const b = submission()
    change(b)
    assert.equal((await f.invoke(eventFor(b))).statusCode, 400)
    assert.equal(f.catalogRequests.length + f.letters.length, 0)
  }
  const f = fixture()
  const e = eventFor()
  for (const [patch, expected] of [[{ body: '{' }, 400], [{ body: 'ё'.repeat(9000) }, 413],
    [{ body: Buffer.alloc(18000).toString('base64'), isBase64Encoded: true }, 413],
    [{ httpMethod: 'GET' }, 405], [{ headers: { Origin: env.SITE_ORIGINS } }, 415]]) {
    assert.equal((await f.invoke({ ...e, ...patch })).statusCode, expected)
  }
  assert.equal(f.catalogRequests.length + f.letters.length, 0)
})

test('fresh public tariff rows produce PDF attachment and receipt; contact stays out of catalog requests', async () => {
  const f = fixture()
  const event = eventFor()
  const result = await f.invoke({ ...event, body: Buffer.from(event.body).toString('base64'), isBase64Encoded: true })
  assert.equal(result.statusCode, 200)
  const receipt = JSON.parse(result.body)
  assert.equal(receipt.snapshot.total, 51000)
  assert.deepEqual(receipt.snapshot.accessories, ['Дверной глазок'])
  assert.ok(Date.parse(receipt.createdAt))
  assert.ok(!result.body.includes(submission().contact.name))
  assert.equal(f.catalogRequests.length, 5)
  for (const { address, init } of f.catalogRequests) {
    assert.equal(init.method ?? 'GET', 'GET')
    assert.equal(init.body, undefined)
    assert.deepEqual(init.headers, { apikey: env.SUPABASE_PUBLISHABLE_KEY })
    assert.ok([...address.searchParams.keys()].every(key => ['select', 'order', 'is_visible'].includes(key)))
    if (/models|finishes|accessories/.test(address.pathname)) assert.equal(address.searchParams.get('is_visible'), 'eq.true')
  }
  assert.equal(f.letters.length, 1)
  const letter = f.letters[0]
  assert.equal(letter.FromEmailAddress, env.POSTBOX_FROM)
  assert.deepEqual(letter.Destination.ToAddresses, [env.POSTBOX_TO])
  assert.ok(letter.Content.Simple.Body.Text.Data.includes(submission().contact.name))
  const [file] = letter.Content.Simple.Attachments
  assert.equal(file.FileName, receipt.number + '.pdf')
  assert.equal(file.ContentType, 'application/pdf')
  assert.match(Buffer.from(file.RawContent, 'base64').subarray(0, 8).toString(), /^%PDF-1\./)
})

test('price changes, including offsetting changes at equal total, require explicit resubmission', async () => {
  const f = fixture()
  const b = submission()
  f.tables.door_models[0].base_price += 1000
  f.tables.door_finishes[0].surcharge -= 1000
  const first = await f.invoke(eventFor(b))
  assert.equal(first.statusCode, 409)
  assert.equal(f.letters.length, 0)
  b.quote = JSON.parse(first.body).snapshot
  f.tables.door_service_tariffs[0].price += 300
  const next = await f.invoke(eventFor(b))
  assert.equal(next.statusCode, 409)
  assert.equal(f.letters.length, 0)
  b.quote = JSON.parse(next.body).snapshot
  assert.equal(b.quote.total, 51300)
  assert.equal((await f.invoke(eventFor(b))).statusCode, 200)
  assert.equal(f.letters.length, 1)
})

test('deleted option, unavailable catalog, PDF error and unconfirmed email yield safe failures', async () => {
  for (const [options, code] of [[{ catalogFailure: true }, 503], [{ render() { throw Error('secret') } }, 503],
    [{ mailFailure: true }, 502], [{ missing: true }, 422]]) {
    const f = fixture({}, options)
    if (options.missing) f.tables.door_accessories.length = 0
    const result = await f.invoke(eventFor())
    assert.equal(result.statusCode, code)
    assert.doesNotMatch(result.body, /sensitive|secret|fixture-token|Учебный пример/)
    assert.equal(f.letters.length, options.mailFailure ? 1 : 0)
  }
})

test('warm instance limits repeated attempts', async () => {
  const f = fixture()
  const e = { ...eventFor(), body: '{}' }
  for (let n = 0; n < 8; n++) assert.equal((await f.invoke(e)).statusCode, 400)
  assert.equal((await f.invoke(e)).statusCode, 429)
})

test('interior selection uses server labels and leaves the price unchanged', async () => {
  const f = fixture()
  const body = submission()
  body.configuration.interiorId = 'latte'
  const result = await f.invoke(eventFor(body))
  assert.equal(result.statusCode, 200)
  const { snapshot } = JSON.parse(result.body)
  assert.equal(snapshot.interior, 'Латте')
  assert.match(snapshot.construction, /80 мм/)
  assert.equal(snapshot.total, body.quote.total)
  body.configuration.interiorId = 'Неизвестная панель'
  assert.equal((await f.invoke(eventFor(body))).statusCode, 422)
  assert.equal(f.letters.length, 1)
})

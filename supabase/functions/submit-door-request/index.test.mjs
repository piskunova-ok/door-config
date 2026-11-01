import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText

for (const value of [undefined, 'false', 'TRUE']) {
  test(`requests are disabled with DOOR_REQUESTS_ENABLED=${value ?? 'unset'}`, async () => {
    let handler
    let networkCalls = 0
    runInNewContext(compiled, {
      Deno: { env: { get: name => name === 'SITE_ORIGINS' ? 'https://door.example' : name === 'DOOR_REQUESTS_ENABLED' ? value : undefined }, serve: callback => { handler = callback } },
      Response,
      fetch: () => { networkCalls++; throw new Error('Network must not be called') },
    })
    const request = new Request('https://project.supabase.co/functions/v1/submit-door-request', {
      method: 'POST', headers: { origin: 'https://door.example', 'content-type': 'application/json' }, body: '{invalid-json',
    })
    const response = await handler(request)
    assert.equal(response.status, 503)
    assert.equal((await response.json()).error, 'Приём заявок временно недоступен.')
    assert.equal(networkCalls, 0)
  })
}

// Deploy with --no-verify-jwt: visitors have no session. The RPC is service_role only.
declare const Deno: { env: { get(name: string): string | undefined } }

const json = (body: unknown, status = 200, origin = '*') => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': origin, 'vary': 'Origin' },
})
const string = (value: unknown, max: number) => typeof value === 'string' && value.length <= max ? value : null

Deno.serve(async (request: Request) => {
  const origin = request.headers.get('origin') ?? ''
  const allowed = (Deno.env.get('SITE_ORIGINS') ?? '').split(',').map(item => item.trim()).filter(Boolean)
  if (!allowed.includes(origin)) return json({ error: 'Этот источник не разрешён.' }, 403)
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: {
    'access-control-allow-origin': origin, 'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info', 'vary': 'Origin',
  } })
  if (request.method !== 'POST') return json({ error: 'Метод не поддерживается.' }, 405, origin)
  if (Deno.env.get('DOOR_REQUESTS_ENABLED') !== 'true') return json({ error: 'Приём заявок временно недоступен.' }, 503, origin)
  if (Number(request.headers.get('content-length') ?? 0) > 12000) return json({ error: 'Слишком большой запрос.' }, 413, origin)
  try {
    const body = await request.json()
    if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'Некорректный запрос.' }, 400, origin)
    if (body.website || !Number.isFinite(body.startedAt) || Date.now() - body.startedAt < 3000 || Date.now() - body.startedAt > 86400000) {
      return json({ error: 'Не удалось отправить форму. Обновите страницу и повторите попытку.' }, 400, origin)
    }
    const config = body.configuration
    const contact = body.contact
    if (!config || typeof config !== 'object' || !Array.isArray(config.accessoryIds) || config.accessoryIds.length > 20 ||
      !string(config.modelId, 64) || !string(config.finishId, 64) || !string(config.sizeId, 64) ||
      config.accessoryIds.some((id: unknown) => !string(id, 64)) || typeof config.delivery !== 'boolean' || typeof config.installation !== 'boolean' ||
      !contact || typeof contact !== 'object' || !string(contact.name, 100) || !string(contact.phone, 25) ||
      string(contact.email, 254) === null || string(contact.comment, 2000) === null || contact.consent !== true) {
      return json({ error: 'Проверьте параметры и контактные данные.' }, 400, origin)
    }
    const url = Deno.env.get('SUPABASE_URL')
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const salt = Deno.env.get('REQUEST_IP_SALT')
    if (!url || !key || !salt) return json({ error: 'Приём заявок пока не настроен.' }, 503, origin)
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${ip}`))
    const ipHash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
    const saved = await fetch(`${url}/rest/v1/rpc/create_door_request`, {
      method: 'POST', headers: { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ p_config: config, p_contact: contact, p_ip_hash: ipHash }),
    })
    if (!saved.ok) {
      const details = await saved.json().catch(() => ({}))
      const code = String(details.message ?? '')
      if (code === 'rate_limited') return json({ error: 'Слишком много заявок. Попробуйте позже.' }, 429, origin)
      if (code.startsWith('invalid_') || code === 'duplicate_accessories') return json({ error: 'Конфигурация или контакты устарели. Проверьте выбор и повторите отправку.' }, 400, origin)
      console.error('Request RPC failed', details.code ?? saved.status)
      return json({ error: 'Не удалось сохранить заявку. Повторите попытку.' }, 503, origin)
    }
    const result = await saved.json()
    let notificationSent = false
    const resendKey = Deno.env.get('RESEND_API_KEY')
    const notifyTo = Deno.env.get('ADMIN_NOTIFICATION_EMAIL')
    const notifyFrom = Deno.env.get('RESEND_FROM_EMAIL')
    if (resendKey && notifyTo && notifyFrom) {
      try {
        const lines = result.snapshot.lines.map((line: { label: string; amount: number }) => `${line.label}: ${line.amount} ₽`).join('\n')
        const email = await fetch('https://api.resend.com/emails', {
          method: 'POST', headers: { authorization: `Bearer ${resendKey}`, 'content-type': 'application/json' },
          body: JSON.stringify({ from: notifyFrom, to: [notifyTo], subject: `Заявка DOOR CONFIG ${result.number}`,
            text: `Новая заявка ${result.number}\nИмя: ${contact.name}\nТелефон: ${contact.phone}\nEmail: ${contact.email || '—'}\nКомментарий: ${contact.comment || '—'}\n\nМодель: ${result.snapshot.model}\nОтделка: ${result.snapshot.finish}\nРазмер: ${result.snapshot.size}\n${lines}\nИтого: ${result.snapshot.total} ₽` }),
        })
        notificationSent = email.ok
        if (!email.ok) console.error('Resend failed', email.status)
      } catch (error) { console.error('Resend network error', error) }
    }
    return json({ number: result.number, snapshot: result.snapshot, notificationSent }, 200, origin)
  } catch (error) {
    console.error('Submit error', error)
    return json({ error: 'Не удалось обработать заявку. Повторите попытку.' }, 500, origin)
  }
})

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.ts'
import type { EstimateRow, RequestRow } from '../lib/database.types.ts'

const money = (value: number) => new Intl.NumberFormat('ru-RU').format(value) + ' ₽'

export default function RequestsPanel() {
  const [requests, setRequests] = useState<RequestRow[]>([])
  const [estimates, setEstimates] = useState<Map<string, EstimateRow>>(new Map())
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const refresh = async () => {
    if (!supabase) return
    setError(''); setLoading(true)
    try {
      const [requestResult, estimateResult] = await Promise.all([
        supabase.from('door_requests').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('door_estimates').select('*').order('created_at', { ascending: false }).limit(100),
      ])
      if (requestResult.error) throw requestResult.error
      if (estimateResult.error) throw estimateResult.error
      setRequests(requestResult.data ?? [])
      setEstimates(new Map((estimateResult.data ?? []).map(row => [row.id, row])))
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось загрузить заявки.') }
    finally { setLoading(false) }
  }
  useEffect(() => { void refresh() }, [])
  const setStatus = async (row: RequestRow, status: RequestRow['status']) => {
    if (!supabase) return
    setBusyId(row.id); setError('')
    const result = await supabase.from('door_requests').update({ status }).eq('id', row.id).select('id').single()
    if (result.error) setError(`Не удалось обновить статус: ${result.error.message}`)
    else setRequests(previous => previous.map(item => item.id === row.id ? { ...item, status } : item))
    setBusyId(null)
  }
  return <section className="admin-panel admin-requests" id="admin-requests"><div className="admin-panel-heading"><div><span className="section-kicker">04 / ЗАЯВКИ</span><h2>Заявки</h2></div><button className="admin-link-button" onClick={() => void refresh()}>Обновить</button></div>
    {error && <p className="admin-message" role="alert">{error}</p>}{loading ? <p className="admin-muted">Загружаем заявки…</p> : requests.length === 0 ? <p className="admin-muted">Заявок пока нет.</p> : <div className="admin-request-list">{requests.map(row => { const estimate = estimates.get(row.estimate_id); return <article className="admin-request" key={row.id}><header><strong>№ {estimate?.number ?? 'Расчёт недоступен'}</strong><time>{new Date(row.created_at).toLocaleString('ru-RU')}</time></header><p><b>{row.customer_name}</b> · <a href={`tel:${row.phone}`}>{row.phone}</a>{row.email && <> · <a href={`mailto:${row.email}`}>{row.email}</a></>}</p>{row.comment && <p>{row.comment}</p>}{estimate && <><p>{estimate.snapshot.model} · {estimate.snapshot.finish} · {estimate.snapshot.size}</p><ul>{estimate.snapshot.lines.map(line => <li key={line.key}>{line.label}: {money(line.amount)}</li>)}</ul><strong>Итого: {money(estimate.total)}</strong></>}<label>Статус <select value={row.status} disabled={busyId === row.id} onChange={event => void setStatus(row, event.target.value as RequestRow['status'])}><option value="new">Новая</option><option value="in_progress">В работе</option><option value="completed">Завершена</option></select></label></article> })}</div>}
  </section>
}

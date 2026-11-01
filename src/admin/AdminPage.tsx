import { useEffect, useState } from 'react'
import { isAuthRetryableFetchError, isAuthSessionMissingError } from '@supabase/supabase-js'
import { imageManifest } from '../data/imageManifest.ts'
import { loadCatalogRows } from '../lib/catalogApi.ts'
import type { AccessoryRow, CatalogRows, FinishRow, ModelRow, ServiceRow, SizeRow } from '../lib/catalogApi.ts'
import { supabase, supabaseConfigured, supabaseConfigurationError, supabaseConfigurationIncomplete } from '../lib/supabase.ts'
import RequestsPanel from './RequestsPanel.tsx'

type AuthStatus = 'checking' | 'signedOut' | 'denied' | 'ready' | 'error'

function authErrorMessage(error: unknown, fallback: string): string {
  if (isAuthRetryableFetchError(error) || (error instanceof TypeError && /fetch|network/i.test(error.message))) {
    return 'Не удалось связаться с Supabase. Проверьте подключение и повторите попытку.'
  }
  return error instanceof Error ? error.message : fallback
}
const priceValid = (value: number) => Number.isSafeInteger(value) && value >= 0
const slugValid = (value: string) => /^[a-z][a-z0-9-]{1,62}$/.test(value)
const money = (value: number) => new Intl.NumberFormat('ru-RU').format(value) + ' ₽'

const newModel = (): ModelRow => ({
  id: '', name: '', tagline: '', description: '', features: [], base_price: 0,
  asset_model_id: 'dc-02-minimal', sizes: [], is_visible: false, sort_order: 100,
})

function PriceEditor({ label, value, visible, disabled, onSave }: {
  label: string
  value: number
  visible?: boolean
  disabled: boolean
  onSave: (price: number, isVisible?: boolean) => Promise<void>
}) {
  const [price, setPrice] = useState(String(value))
  const [isVisible, setIsVisible] = useState(visible ?? true)
  useEffect(() => { setPrice(String(value)); setIsVisible(visible ?? true) }, [value, visible])
  const parsed = Number(price)
  return <div className="admin-price-row"><span>{label}</span><label><span>Цена, ₽</span><input type="number" min="0" step="1" value={price} onChange={event => setPrice(event.target.value)} /></label>{visible !== undefined && <label className="admin-check"><input type="checkbox" checked={isVisible} onChange={event => setIsVisible(event.target.checked)} /> Показывать</label>}<button disabled={disabled || price.trim() === '' || !priceValid(parsed)} onClick={() => void onSave(parsed, isVisible)}>Сохранить</button></div>
}

export default function AdminPage() {
  const [status, setStatus] = useState<AuthStatus>('checking')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rows, setRows] = useState<CatalogRows | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [modelDraft, setModelDraft] = useState<ModelRow | null>(null)
  const [creatingModel, setCreatingModel] = useState(false)
  const [finishDraft, setFinishDraft] = useState<FinishRow | null>(null)
  const [creatingFinish, setCreatingFinish] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const refresh = async (preferredId?: string) => {
    const next = await loadCatalogRows(false)
    setRows(next)
    const id = preferredId ?? selectedId ?? next.models[0]?.id ?? null
    setSelectedId(id)
    setModelDraft(next.models.find(item => item.id === id) ?? null)
    setCreatingModel(false)
    setFinishDraft(null)
    setCreatingFinish(false)
  }

  const checkAccess = async () => {
    if (!supabase) return
    setStatus('checking')
    setMessage('')
    try {
      const { data, error } = await supabase.auth.getUser()
      if (error && !isAuthSessionMissingError(error)) throw error
      if (!data.user || isAuthSessionMissingError(error)) {
        setRows(null)
        setStatus('signedOut')
        return
      }
      const membership = await supabase.from('door_admins').select('user_id').eq('user_id', data.user.id).maybeSingle()
      if (membership.error) throw new Error(membership.error.message)
      if (!membership.data) { setStatus('denied'); return }
      await refresh()
      setStatus('ready')
    } catch (error) {
      setMessage(authErrorMessage(error, 'Не удалось проверить доступ.'))
      setStatus('error')
    }
  }

  useEffect(() => {
    if (!supabase) return
    void checkAccess()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_OUT') { setRows(null); setPassword(''); setMessage(''); setStatus('signedOut') }
    })
    return () => subscription.unsubscribe()
    // Проверка выполняется при открытии раздела; вход вызывает её повторно.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const signIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase) return
    setBusy(true); setMessage('')
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setMessage(error.code === 'invalid_credentials'
          ? 'Не удалось войти. Проверьте адрес и пароль.'
          : authErrorMessage(error, 'Не удалось войти. Повторите попытку.'))
        return
      }
      await checkAccess()
    } catch (error) {
      setMessage(authErrorMessage(error, 'Не удалось войти. Повторите попытку.'))
    } finally {
      setPassword('')
      setBusy(false)
    }
  }

  const signOut = async () => {
    if (!supabase) return
    setBusy(true); setMessage('')
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      setRows(null)
      setPassword('')
      setStatus('signedOut')
    } catch (error) {
      setMessage(`Не удалось выйти: ${authErrorMessage(error, 'Повторите попытку.')}`)
    } finally { setBusy(false) }
  }

  const selectModel = (row: ModelRow) => {
    setSelectedId(row.id); setModelDraft({ ...row, sizes: [...row.sizes], features: [...row.features] })
    setCreatingModel(false); setFinishDraft(null); setMessage('')
  }

  const saveModel = async () => {
    if (!supabase || !modelDraft || !rows) return
    if (!slugValid(modelDraft.id) || !modelDraft.name.trim() || !priceValid(modelDraft.base_price) || modelDraft.sizes.length === 0) {
      setMessage('Укажите уникальный ID латиницей, название, неотрицательную цену и хотя бы один размер.'); return
    }
    if (creatingModel && rows.models.some(item => item.id === modelDraft.id)) { setMessage('Модель с таким ID уже существует.'); return }
    if (modelDraft.is_visible && !rows.finishes.some(item => item.model_id === modelDraft.id && item.is_visible)) {
      setMessage('Сначала сохраните хотя бы одну видимую отделку, затем опубликуйте модель.'); return
    }
    setBusy(true); setMessage('')
    try {
      const { error } = await supabase.from('door_models').upsert({ ...modelDraft, name: modelDraft.name.trim() }, { onConflict: 'id' }).select('id').single()
      if (error) throw new Error(error.message)
      await refresh(modelDraft.id)
      setMessage('Модель сохранена. Публичный каталог получит изменения при обновлении.')
    } catch (error) {
      setMessage(`Не удалось сохранить модель: ${error instanceof Error ? error.message : 'ошибка базы'}`)
    } finally { setBusy(false) }
  }

  const imageOptions: string[] = modelDraft ? [
    ...Object.values(imageManifest[modelDraft.asset_model_id]),
    ...Object.keys(imageManifest[modelDraft.asset_model_id]).map(code => `/images/doors/${modelDraft.asset_model_id}__${code}.webp`),
  ] : []
  const selectedFinishes = rows?.finishes.filter(item => item.model_id === selectedId) ?? []

  const startFinish = () => {
    if (!selectedId || !modelDraft || !imageOptions[0]) return
    setFinishDraft({ model_id: selectedId, code: '', name: '', detail: '', tone: '#777777', surcharge: 0, image_path: imageOptions[0], is_visible: false, sort_order: selectedFinishes.length + 1 })
    setCreatingFinish(true)
  }

  const saveFinish = async () => {
    if (!supabase || !finishDraft || !selectedId) return
    if (!slugValid(finishDraft.code) || !finishDraft.name.trim() || !priceValid(finishDraft.surcharge) || !imageOptions.includes(finishDraft.image_path)) {
      setMessage('Проверьте ID, название, цену и изображение отделки.'); return
    }
    if (creatingFinish && selectedFinishes.some(item => item.code === finishDraft.code)) { setMessage('Такая отделка уже существует.'); return }
    setBusy(true); setMessage('')
    try {
      const { error } = await supabase.from('door_finishes').upsert({ ...finishDraft, model_id: selectedId, name: finishDraft.name.trim() }, { onConflict: 'model_id,code' }).select('code').single()
      if (error) throw new Error(error.message)
      await refresh(selectedId)
      setMessage('Отделка сохранена.')
    } catch (error) {
      setMessage(`Не удалось сохранить отделку: ${error instanceof Error ? error.message : 'ошибка базы'}`)
    } finally { setBusy(false) }
  }

  const savePrice = async (table: 'door_sizes' | 'door_accessories' | 'door_service_tariffs', id: string, price: number, visible?: boolean) => {
    if (!supabase || !priceValid(price)) return
    setBusy(true); setMessage('')
    try {
      if (table === 'door_sizes') {
        const { error } = await supabase.from('door_sizes').update({ surcharge: price }).eq('id', id).select('id').single()
        if (error) throw new Error(error.message)
      } else if (table === 'door_accessories') {
        const { error } = await supabase.from('door_accessories').update({ price, is_visible: visible ?? true }).eq('id', id).select('id').single()
        if (error) throw new Error(error.message)
      } else {
        if (id !== 'delivery' && id !== 'installation') throw new Error('Неизвестная услуга.')
        const { error } = await supabase.from('door_service_tariffs').update({ price }).eq('id', id).select('id').single()
        if (error) throw new Error(error.message)
      }
      await refresh(selectedId ?? undefined)
      setMessage('Тариф сохранён.')
    } catch (error) {
      setMessage(`Не удалось сохранить тариф: ${error instanceof Error ? error.message : 'ошибка базы'}`)
    } finally { setBusy(false) }
  }

  const brand = <a className="brand" href="/"><span className="brand-mark">D<span>.</span></span><span>DOOR <b>CONFIG</b></span></a>
  if (!supabaseConfigured) {
    return <main className="admin-gate">{brand}<span className="section-kicker">АДМИНИСТРИРОВАНИЕ</span><h1>База данных ещё не подключена.</h1><p>{supabaseConfigurationError ?? (supabaseConfigurationIncomplete ? 'Параметры Supabase заполнены не полностью.' : 'Сейчас публичная часть работает в локальном режиме.')} Для настоящей админки создайте отдельный проект DOOR CONFIG, примените SQL из папки supabase и заполните `.env.local` публичными параметрами проекта.</p><a className="admin-back" href="/">← Вернуться в каталог</a></main>
  }
  if (status === 'checking') return <main className="admin-gate">{brand}<h1>Проверяем доступ…</h1></main>
  if (status === 'signedOut') return <main className="admin-gate">{brand}<span className="section-kicker">ЗАЩИЩЁННЫЙ РАЗДЕЛ</span><h1>Вход администратора</h1><form className="admin-login" onSubmit={event => void signIn(event)}><label>Email<input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="username" required /></label><label>Пароль<input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" required /></label><button className="primary-button" disabled={busy}>Войти ↗</button></form>{message && <p className="admin-message" role="alert">{message}</p>}<a className="admin-back" href="/">← Вернуться в каталог</a></main>
  if (status === 'denied') return <main className="admin-gate">{brand}<h1>Нет прав администратора</h1><p>Учётная запись существует, но её ID не добавлен в `door_admins` отдельного проекта DOOR CONFIG.</p>{message && <p className="admin-message" role="alert">{message}</p>}<button className="admin-link-button" disabled={busy} onClick={() => void signOut()}>Выйти</button></main>
  if (status === 'error' || !rows) return <main className="admin-gate">{brand}<h1>Не удалось открыть админку</h1><p role="alert">{message}</p><button className="primary-button" onClick={() => void checkAccess()}>Повторить ↗</button></main>

  return <div className="admin-page"><header className="admin-header">{brand}<div><a href="/">Открыть каталог ↗</a><button disabled={busy} onClick={() => void signOut()}>Выйти</button></div></header><main className="admin-main"><div className="admin-title"><div><span className="section-kicker">УПРАВЛЕНИЕ КАТАЛОГОМ</span><h1>Административная панель</h1><p>Изменения сохраняются в Supabase. Публичные цены и доступность обновляются из базы.</p></div><span className="admin-live-badge">ПОДКЛЮЧЕНО К БАЗЕ</span></div>{message && <div className="admin-message" role="status">{message}</div>}
    <div className="admin-layout"><aside className="admin-sidebar"><div className="admin-sidebar-title"><h2>Модели</h2><button onClick={() => { setCreatingModel(true); setSelectedId(null); setModelDraft(newModel()); setFinishDraft(null); setMessage('') }}>+ Добавить</button></div>{rows.models.map(row => <button key={row.id} className={`admin-model-item ${selectedId === row.id && !creatingModel ? 'is-active' : ''}`} onClick={() => selectModel(row)}><strong>{row.name}</strong><span>{row.is_visible ? 'В каталоге' : 'Скрыта'} · {money(row.base_price)}</span></button>)}</aside>
      <div className="admin-content">{modelDraft && <section className="admin-panel"><div className="admin-panel-heading"><div><span className="section-kicker">01 / МОДЕЛЬ</span><h2>{creatingModel ? 'Новая модель' : `Модель ${modelDraft.name}`}</h2></div><span className="admin-muted">{creatingModel ? 'Сначала сохраните модель скрытой' : modelDraft.id}</span></div><div className="admin-fields"><label>ID модели<input value={modelDraft.id} disabled={!creatingModel} onChange={event => setModelDraft({ ...modelDraft, id: event.target.value.trim().toLowerCase() })} placeholder="new-model" /></label><label>Название<input value={modelDraft.name} onChange={event => setModelDraft({ ...modelDraft, name: event.target.value })} /></label><label>Подзаголовок<input value={modelDraft.tagline} onChange={event => setModelDraft({ ...modelDraft, tagline: event.target.value })} /></label><label>Базовая цена, ₽<input type="number" min="0" step="1" value={modelDraft.base_price} onChange={event => setModelDraft({ ...modelDraft, base_price: Number(event.target.value) })} /></label><label className="admin-wide">Описание<textarea rows={3} value={modelDraft.description} onChange={event => setModelDraft({ ...modelDraft, description: event.target.value })} /></label><label className="admin-wide">Краткие характеристики через запятую<input value={modelDraft.features.join(', ')} onChange={event => setModelDraft({ ...modelDraft, features: event.target.value.split(',').map(value => value.trim()).filter(Boolean) })} /></label><label>Набор существующих изображений<select value={modelDraft.asset_model_id} disabled={!creatingModel} onChange={event => setModelDraft({ ...modelDraft, asset_model_id: event.target.value as ModelRow['asset_model_id'] })}>{Object.keys(imageManifest).map(id => <option key={id} value={id}>{id}</option>)}</select></label><div className="admin-size-choices"><span>Доступные размеры</span>{rows.sizes.map(size => <label key={size.id}><input type="checkbox" checked={modelDraft.sizes.includes(size.id)} onChange={event => setModelDraft({ ...modelDraft, sizes: event.target.checked ? [...modelDraft.sizes, size.id] : modelDraft.sizes.filter(id => id !== size.id) })} /> {size.label}</label>)}</div><label className="admin-check admin-wide"><input type="checkbox" checked={modelDraft.is_visible} onChange={event => setModelDraft({ ...modelDraft, is_visible: event.target.checked })} /> Показывать модель в публичном каталоге</label></div><button className="primary-button" disabled={busy} onClick={() => void saveModel()}>Сохранить модель ↗</button></section>}
      {selectedId && !creatingModel && <section className="admin-panel"><div className="admin-panel-heading"><div><span className="section-kicker">02 / ОТДЕЛКИ</span><h2>Варианты отделки</h2></div><button className="admin-link-button" onClick={startFinish}>+ Добавить отделку</button></div><div className="admin-finish-list">{selectedFinishes.map(item => <button key={item.code} className="admin-finish-item" onClick={() => { setFinishDraft({ ...item }); setCreatingFinish(false) }}><img src={item.image_path} alt="" /><span><strong>{item.name}</strong><small>{item.is_visible ? 'В каталоге' : 'Скрыта'} · {money(item.surcharge)}</small></span><span>Изменить ↗</span></button>)}</div>{finishDraft && <div className="admin-finish-editor"><h3>{creatingFinish ? 'Новая отделка' : `Отделка ${finishDraft.name}`}</h3><div className="admin-fields"><label>ID отделки<input value={finishDraft.code} disabled={!creatingFinish} onChange={event => setFinishDraft({ ...finishDraft, code: event.target.value.trim().toLowerCase() })} placeholder="new-finish" /></label><label>Название<input value={finishDraft.name} onChange={event => setFinishDraft({ ...finishDraft, name: event.target.value })} /></label><label>Описание<input value={finishDraft.detail} onChange={event => setFinishDraft({ ...finishDraft, detail: event.target.value })} /></label><label>Надбавка, ₽<input type="number" min="0" step="1" value={finishDraft.surcharge} onChange={event => setFinishDraft({ ...finishDraft, surcharge: Number(event.target.value) })} /></label><label>Цвет образца<input type="color" value={finishDraft.tone} onChange={event => setFinishDraft({ ...finishDraft, tone: event.target.value })} /></label><label>Существующее изображение<select value={finishDraft.image_path} onChange={event => setFinishDraft({ ...finishDraft, image_path: event.target.value })}>{imageOptions.map(path => <option key={path} value={path}>{path.split('/').pop()}</option>)}</select></label><label className="admin-check admin-wide"><input type="checkbox" checked={finishDraft.is_visible} onChange={event => setFinishDraft({ ...finishDraft, is_visible: event.target.checked })} /> Показывать отделку</label></div><img className="admin-image-preview" src={finishDraft.image_path} alt="Предпросмотр выбранной отделки" /><button className="primary-button" disabled={busy} onClick={() => void saveFinish()}>Сохранить отделку ↗</button></div>}</section>}
      <section className="admin-panel"><div className="admin-panel-heading"><div><span className="section-kicker">03 / ТАРИФЫ</span><h2>Комплектующие и услуги</h2></div></div><p className="admin-muted">Цены каталога редактируются здесь. Рыночные ориентиры производителя хранятся отдельно в исходном справочнике.</p><h3>Комплектующие</h3>{rows.accessories.map((row: AccessoryRow) => <PriceEditor key={row.id} label={row.name} value={row.price} visible={row.is_visible} disabled={busy} onSave={(price, visible) => savePrice('door_accessories', row.id, price, visible)} />)}<h3>Доставка и монтаж</h3>{rows.services.map((row: ServiceRow) => <PriceEditor key={row.id} label={row.id === 'delivery' ? 'Доставка' : 'Монтаж'} value={row.price} disabled={busy} onSave={price => savePrice('door_service_tariffs', row.id, price)} />)}<h3>Надбавки за размер</h3>{rows.sizes.map((row: SizeRow) => <PriceEditor key={row.id} label={row.label} value={row.surcharge} disabled={busy} onSave={price => savePrice('door_sizes', row.id, price)} />)}</section></div></div>
    <RequestsPanel />
  </main></div>
}

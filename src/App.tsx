import SavedConfigurations from './SavedConfigurations.tsx'
import { readVariants, type Slot, type Variant } from './lib/savedConfigurations.ts'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { DoorModel, Finish } from './data/catalog.ts'
import type { CatalogData } from './data/catalogData.ts'
import { interiorFinishImage, interiorImageManifest } from './data/imageManifest.ts'
import { constructionSummary, interiorColor, interiorMaterial, interiorOptions, modelSpec } from './data/doorSpecs.ts'
import { ConstructionDiagram, ModelPassport } from './ModelPassport.tsx'
import { calculateEstimate, emptyConfiguration } from './lib/pricing.ts'
import type { Configuration } from './lib/pricing.ts'

type SavedRequest = { number: string; createdAt: string; snapshot: { model: string; finish: string; size: string; interior?: string; construction?: string; image: string; lines: { key: string; label: string; amount: number }[]; total: number } }

const money = (value: number) => new Intl.NumberFormat('ru-RU').format(value) + ' ₽'
const requestUrl = import.meta.env.VITE_DOOR_REQUEST_URL?.trim() ?? ''
const requestsEnabled = import.meta.env.VITE_DOOR_REQUESTS_ENABLED === 'true' &&
  /^https:\/\/functions\.yandexcloud\.net\/[a-z0-9-]+$/.test(requestUrl)

function isSnapshot(value: unknown): value is SavedRequest['snapshot'] {
  if (!value || typeof value !== 'object') return false
  const data = value as Partial<SavedRequest['snapshot']>
  return [data.model, data.finish, data.size, data.image].every(item => typeof item === 'string') &&
    Number.isSafeInteger(data.total) && Array.isArray(data.lines) &&
    data.lines.every(line => line && typeof line.key === 'string' && typeof line.label === 'string' && Number.isSafeInteger(line.amount))
}


function DoorVisual({ model, finish, compact = false, interactive = false, hoverInterior = false, exteriorImage, interiorId, previewFinishLabel }: { model: DoorModel; finish: Finish; compact?: boolean; interactive?: boolean; hoverInterior?: boolean; exteriorImage?: string; interiorId?: string; previewFinishLabel?: string }) {
  const [side, setSide] = useState<'exterior' | 'interior'>('exterior')
  const interior = interiorImageManifest[model.assetModelId]
  const color = interiorColor(model.id, interiorId)
  useEffect(() => setSide(interiorId ? 'interior' : 'exterior'), [model.id, interiorId])
  return (
    <><figure className={`door-scene ${compact ? 'door-scene--compact' : ''} ${interactive ? 'door-scene--two-sided' : ''}`} data-side={side} onPointerEnter={interactive && hoverInterior ? event => { if (event.pointerType === 'mouse') setSide('interior') } : undefined} onPointerLeave={interactive && hoverInterior ? event => { if (event.pointerType === 'mouse') setSide('exterior') } : undefined}>
      <img className="door-image--exterior" src={exteriorImage ?? finish.image} alt={`Наружная сторона двери ${model.name}, отделка ${finish.name}`} loading={compact ? 'lazy' : 'eager'} decoding="async" />
      {interactive && <img className="door-image--interior" src={color ? interiorFinishImage(model.id, color.id) : interior} alt={`Внутренняя сторона двери ${model.name}${color ? ', ' + color.name : ''}`} decoding="async" />}
      <figcaption className="scene-caption">{side === 'interior' ? (interiorId === undefined ? 'Пример внутренней стороны' : color?.name ?? 'Внутренняя панель') : 'Демонстрационная 2D-визуализация'}</figcaption>
      {interactive && <><span className="side-hint">Вид изнутри</span><div className="side-switch" aria-label={`Сторона двери ${model.name}`}><button type="button" className={side === 'exterior' ? 'is-active' : ''} aria-pressed={side === 'exterior'} onClick={() => setSide('exterior')}>Снаружи</button><button type="button" className={side === 'interior' ? 'is-active' : ''} aria-pressed={side === 'interior'} onClick={() => setSide('interior')}>Изнутри</button></div></>}
    </figure>
      {previewFinishLabel && <div className="preview-bottom"><div><span>{side === 'interior' ? 'ВНУТРЕННИЙ ЦВЕТ' : 'ОТДЕЛКА'}</span><strong>{side === 'interior' ? color?.name ?? 'Не выбран' : previewFinishLabel}</strong></div><span>2D-визуализация</span></div>}
    </>
  )
}

function RequestSummary({ model, finish, config, catalog, total, valid }: { model?: DoorModel; finish?: Finish; config: Configuration; catalog: CatalogData; total: number | null; valid: boolean }) {
  const [side, setSide] = useState<'exterior' | 'interior'>('exterior')
  const color = interiorColor(config.modelId, config.interiorId)
  const size = catalog.sizes.find(item => item.id === config.sizeId && model?.sizes.includes(item.id))
  const accessories = catalog.accessories.filter(item => config.accessoryIds.includes(item.id))
  return <aside className="request-summary" aria-label="Ваша конфигурация">
    <header className="request-summary-head"><span>ВАША КОНФИГУРАЦИЯ</span>{model && <h3>{model.name}</h3>}</header>
    {model ? <>
      <div className="request-summary-switch" aria-label="Сторона двери"><button type="button" aria-pressed={side === 'exterior'} className={side === 'exterior' ? 'is-active' : ''} onClick={() => setSide('exterior')}>Снаружи</button><button type="button" aria-pressed={side === 'interior'} className={side === 'interior' ? 'is-active' : ''} onClick={() => setSide('interior')}>Изнутри</button></div>
      <div className="request-summary-photos">
        <figure className={`request-summary-photo ${side === 'exterior' ? 'is-current' : ''}`}>{finish ? <img src={finish.image} alt={`Наружная сторона двери ${model.name}, отделка ${finish.name}`} loading="lazy" /> : <div className="request-summary-photo-empty">Выберите наружную отделку</div>}<figcaption>Снаружи</figcaption></figure>
        <figure className={`request-summary-photo ${side === 'interior' ? 'is-current' : ''}`}>{color ? <img src={interiorFinishImage(model.id, color.id)} alt={`Внутренняя сторона двери ${model.name}, ${color.name}`} loading="lazy" /> : <div className="request-summary-photo-empty">Цвет не выбран</div>}<figcaption>Изнутри{color && ` · ${color.name}`}</figcaption></figure>
      </div>
    </> : <p className="request-summary-empty">Выберите модель, чтобы увидеть обе стороны двери.</p>}
    <dl className="request-summary-details">
      <dt>Модель</dt><dd>{model?.name}</dd>
      <dt>Наружная отделка</dt><dd>{finish?.name}</dd>
      <dt>Внутренний цвет</dt><dd>{interiorColor(config.modelId, config.interiorId)?.name ?? (config.interiorId === undefined ? 'Не выбран' : 'Недоступен')}</dd>
      <dt>Размер</dt><dd>{size?.label}</dd>
      <dt>Комплектация</dt><dd>{accessories.map(item => item.name).join(', ')}</dd>
      <dt>Доставка</dt><dd>{config.delivery === null ? null : config.delivery ? 'Нужна' : 'Не требуется'}</dd>
      <dt>Монтаж</dt><dd>{config.installation === null ? null : config.installation ? 'Нужен' : 'Не требуется'}</dd>
    </dl>
    <div className="request-summary-total"><span>ПРЕДВАРИТЕЛЬНАЯ СТОИМОСТЬ</span><strong>{valid && total !== null ? money(total) : null}</strong></div>
  </aside>
}

function App({ catalog, source }: { catalog: CatalogData; source: 'demo' | 'live' }) {
  const { models, sizes } = catalog
  const tariffs = catalog
  const [config, setConfig] = useState<Configuration>(emptyConfiguration)
  const [editing, setEditing] = useState<Slot | null>(null)
  const [comparisonOpen, setComparisonOpen] = useState(false)
  const storageKey = 'door-config.variants.v1.' + source
  const [variantStore, setVariantStore] = useState(() => readVariants(storageKey))
  const variantCount = variantStore.variants.length
  const canCompare = variantCount >= 2
  const comparisonHint = canCompare
    ? 'Ваши варианты готовы к сравнению.'
    : variantCount === 1
      ? 'Для сравнения создайте и сохраните ещё один вариант.'
      : 'Сохраните текущую комплектацию, затем создайте ещё одну для сравнения.'
  const [attempted, setAttempted] = useState(false)
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [notice, setNotice] = useState('')
  const [contact, setContact] = useState({ name: '', phone: '', email: '', comment: '', consent: false, website: '' })
  const [formStartedAt] = useState(() => Date.now())
  const [submitting, setSubmitting] = useState(false)
  const submitInFlight = useRef(false)
  const [submitError, setSubmitError] = useState('')
  const [updatedQuote, setUpdatedQuote] = useState<SavedRequest['snapshot'] | null>(null)
  const selectionVersion = useRef(0)
  const [saved, setSaved] = useState<SavedRequest | null>(null)
  const estimate = useMemo(() => calculateEstimate(config, catalog), [config, catalog])
  const model = models.find(item => item.id === config.modelId)
  const finish = model?.finishes.find(item => item.id === config.finishId)
  const inner = interiorColor(config.modelId, config.interiorId)
  const spec = model && modelSpec(model.id)
  const estimateDetails = [
    inner && 'Изнутри: ' + inner.name,
    finish?.name,
    sizes.find(item => item.id === config.sizeId && model?.sizes.includes(item.id))?.label,
  ].filter(Boolean).join(' · ')
  const previewModel = model ?? models[0]
  const previewFinish = finish ?? previewModel.finishes[0]
  const issuedAt = useMemo(() => new Date(), [])
  const documentNumber = useMemo(() => `DC-${issuedAt.toISOString().slice(0, 10).replaceAll('-', '')}-${Math.floor(Math.random() * 9000 + 1000)}`, [issuedAt])
  const documentDate = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'long' }).format(issuedAt)

  useEffect(() => {
    setSaved(null)
    setUpdatedQuote(null)
    setSubmitError('')
    return () => { selectionVersion.current++ }
  }, [config])

  const submitRequest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!requestsEnabled || source !== 'live' || !estimate.valid || !contact.consent || submitInFlight.current) return
    submitInFlight.current = true
    const version = selectionVersion.current
    const displayed = updatedQuote ?? estimate
    const { website, ...details } = contact
    setSubmitting(true)
    setSubmitError('')
    try {
      const response = await fetch(requestUrl, {
        method: 'POST', credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer',
        signal: AbortSignal.timeout(35000), headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          configuration: config, contact: details, website, startedAt: formStartedAt,
          quote: { total: displayed.total, lines: displayed.lines.map(({ key, amount }) => ({ key, amount })) },
        }),
      })
      const data = await response.json()
      if (version !== selectionVersion.current) return
      if (response.status === 409 && data.code === 'price_changed' && isSnapshot(data.snapshot)) {
        setUpdatedQuote(data.snapshot)
        return
      }
      if (!response.ok) {
        setSubmitError(typeof data.error === 'string' ? data.error : 'Не удалось подтвердить отправку заявки.')
        return
      }
      if (!isSnapshot(data.snapshot) || typeof data.number !== 'string' || !Number.isFinite(Date.parse(data.createdAt))) {
        throw new Error('Invalid receipt')
      }
      setSaved(data)
      setUpdatedQuote(null)
      setNotice('Почтовый сервис принял заявку ' + data.number + '.')
    } catch {
      if (version === selectionVersion.current) setSubmitError('Подтверждение отправки не получено. Заявка могла быть принята. Автоматического повтора не будет.')
    } finally {
      submitInFlight.current = false
      setSubmitting(false)
    }
  }

  useEffect(() => {
    if (editing !== null) return
    setConfig(previous => {
      if (!previous.modelId) return previous
      const currentModel = catalog.models.find(item => item.id === previous.modelId)
      if (!currentModel) return emptyConfiguration
      const finishId = currentModel.finishes.some(item => item.id === previous.finishId) ? previous.finishId : null
      const sizeId = currentModel.sizes.includes(previous.sizeId ?? '') ? previous.sizeId : null
      const accessoryIds = previous.accessoryIds.filter(id => catalog.accessories.some(item => item.id === id))
      if (finishId === previous.finishId && sizeId === previous.sizeId && accessoryIds.length === previous.accessoryIds.length) return previous
      return { ...previous, finishId, sizeId, accessoryIds }
    })
  }, [catalog, editing])

  const markTouched = (key: string) => setTouched(previous => ({ ...previous, [key]: true }))
  const fieldError = (key: string, invalid: boolean) => invalid && (attempted || touched[key])
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  const showOptionsFromEstimate = () => {
    if (canCompare && !comparisonOpen) {
      setComparisonOpen(true)
      return
    }

    const headingId = canCompare ? 'comparison-title' : 'variants-title'
    document.getElementById(headingId)?.focus({ preventScroll: true })
    scrollTo(headingId)
  }

  const loadVariant = (variant: Variant) => {
    setComparisonOpen(false)
    setEditing(variant.slot)
    setConfig({ ...variant.config, accessoryIds: [...variant.config.accessoryIds] })
    setAttempted(true)
    setTouched({})
    setNotice('')
    requestAnimationFrame(() => {
      const heading = document.querySelector<HTMLElement>('#configurator h2')
      heading?.focus({ preventScroll: true })
      scrollTo('configurator')
    })
  }

  const selectModel = (next: DoorModel) => {
    setConfig(previous => editing === null ? { ...emptyConfiguration, modelId: next.id } : { ...previous, modelId: next.id, finishId: null, sizeId: next.sizes.includes(previous.sizeId ?? '') ? previous.sizeId : null })
    setAttempted(false)
    setTouched({ model: true })
    setNotice('')
    requestAnimationFrame(() => scrollTo('configurator'))
  }

  const reset = () => {
    setEditing(null)
    setConfig(emptyConfiguration)
    setAttempted(false)
    setTouched({})
    setNotice('')
    scrollTo('catalog')
  }

  const showEstimate = () => {
    setAttempted(true)
    if (estimate.valid) {
      setNotice('Расчёт готов. Вы можете сохранить смету в PDF.')
      scrollTo('estimate')
    } else {
      setNotice('Заполните отмеченные параметры, чтобы получить расчёт.')
      scrollTo('configurator')
    }
  }

  const savePdf = () => {
    if (!estimate.valid) return
    setNotice('В окне печати выберите «Сохранить как PDF».')
    window.print()
  }

  return (
    <>
      <div className="site-shell">
        <header className="site-header">
          <a className="brand" href="#top" aria-label="DOOR CONFIG — на главную"><span className="brand-mark">D<span>.</span></span><span>DOOR <b>CONFIG</b></span></a>
          <nav aria-label="Основная навигация"><a href="#catalog">Модели</a><a href="#configurator">Конфигуратор</a><a href="#selection">Ваш выбор</a>{requestsEnabled && source === 'live' && <a href="#request">Заявка</a>}</nav>
          <button className="header-action" onClick={() => scrollTo('catalog')}>Начать расчёт <span>↗</span></button>
        </header>
        {source === 'demo' && <div className="catalog-mode-banner" role="status">Локальный режим: Supabase не подключён. Показаны исходные цены; изменения через /admin пока недоступны.</div>}

        <main id="top">
          <section className="hero" aria-labelledby="hero-title">
            <div className="hero-copy">
              <h1 id="hero-title">
                <span className="hero-title-first">У каждой</span>{' '}
                <span className="hero-title-key">ДВЕРИ</span>{' '}
                <span className="hero-title-last">свой характер</span>
              </h1>
              <p className="hero-description">Подберите модель, отделку и комплектацию. Смотрите предварительную стоимость и сохраняйте подробный расчёт.</p>
              <button className="primary-button" onClick={() => scrollTo('catalog')}>Рассчитать стоимость <span aria-hidden="true">↗</span></button>
              <p className="hero-footnote">Предварительный расчёт · стоимость уточняется после замера</p>
            </div>
            <figure className="hero-photo">
              <picture>
                <img src="/images/hero/Herro.jpg" alt="Графитовая входная дверь Axis в современном интерьере" width={5922} height={2422} fetchPriority="high" />
              </picture>
              <span className="hero-collection">Коллекция 2026</span>
              <figcaption className="hero-model"><span className="hero-model-label">Модель коллекции</span><strong>Axis</strong><span className="hero-model-finish">Графит</span></figcaption>
            </figure>
          </section>

          <section className="intro-strip" aria-label="Возможности"><div><strong>{models.length}</strong><span>моделей в коллекции</span></div><div><strong>{models[0].finishes.length}</strong><span>отделки модели</span></div><p>От первого впечатления{' '}<br />до точного решения.</p></section>

          <section className="catalog section-pad" id="catalog">
            <div className="section-head"><div><span className="section-kicker">01 / КОЛЛЕКЦИЯ</span><h2>Найдите свою{' '}<br />дверь.</h2></div><p>Каждая модель имеет свой характер. Выберите её, чтобы перейти к настройке.</p></div>
            <p className="catalog-disclaimer">Демонстрационный проект. Модели, технические характеристики и цены представлены в учебных целях</p>
            <div className="catalog-grid">
              {models.map((item, index) => <article className={`model-card ${config.modelId === item.id ? 'model-card--selected' : ''}`} key={item.id}>
                <div className="card-visual"><DoorVisual model={item} finish={item.finishes[0]} compact interactive hoverInterior /></div>
                <div className="card-body">
                  <div className="card-meta"><span className="card-index">{String(index + 1).padStart(2, '0')} / {String(models.length).padStart(2, '0')}</span><span className="card-tag">{item.tagline}</span></div>
                  <div className="card-title-row"><h3>{item.name}</h3><span>↗</span></div>
                  <p>{item.description}</p>
                  <div className="card-features">{item.features.slice(0, 2).map(feature => <span key={feature}>{feature}</span>)}</div>
                  <ModelPassport model={item} sizes={sizes} />
                  <div className="card-bottom"><div><small>БАЗОВАЯ СТОИМОСТЬ</small><strong>{money(item.demoBasePrice)}</strong></div><button onClick={() => selectModel(item)} aria-label={`Выбрать модель ${item.name}`}>{config.modelId === item.id ? 'Выбрана' : 'Выбрать'} <span>→</span></button></div>
                </div>
              </article>)}
            </div>
            <ConstructionDiagram />
          </section>

          <section className="config-section section-pad" id="configurator">
            <div className="section-head section-head--light"><div><span className="section-kicker">02 / КОНФИГУРАТОР</span><h2 tabIndex={-1}>Создайте{' '}<br />свою конфигурацию.</h2></div><p>Каждый выбор отражается в смете. Окончательную стоимость уточняют после замера.</p></div>
            <div className="config-layout">
              <aside className={`preview-panel ${model ? '' : 'preview-panel--example'}`}><div className="preview-top"><span>ВАШ ВЫБОР</span><strong>{model?.name ?? 'Пример визуализации'}</strong></div><DoorVisual model={previewModel} finish={previewFinish} interiorId={config.interiorId} interactive previewFinishLabel={finish?.name ?? 'Не выбрана'} /></aside>
              <div className="config-form">
                {editing !== null && <p role="status">Редактируется вариант {editing}. Изменения можно сохранить в разделе «Ваш выбор».</p>}
                {editing !== null && !estimate.valid && <p className="field-error">Проверьте параметры: {estimate.errors.join('. ')}.</p>}
                {config.accessoryIds.filter(id => !catalog.accessories.some(a => a.id === id)).map(id =>
                  <p key={id} className="field-error">Комплектующее «{id}» недоступно. <button type="button" onClick={() => setConfig(c => ({ ...c, accessoryIds: c.accessoryIds.filter(a => a !== id) }))}>Убрать из расчёта</button></p>
                )}
                <div className="config-step"><div className="step-heading"><span className="step-number">01</span><div><h3>Модель двери</h3><p>Выберите основу вашей конфигурации</p></div></div><div className="select-grid select-grid--models">{models.map(item => <button key={item.id} className={`select-tile ${config.modelId === item.id ? 'is-active' : ''}`} onClick={() => selectModel(item)}><strong>{item.name}</strong><span>от {money(item.demoBasePrice)}</span></button>)}</div>{fieldError('model', !model) && <p className="field-error">Выберите модель двери.</p>}</div>

                <div className="config-step"><div className="step-heading"><span className="step-number">02</span><div><h3>Наружная отделка</h3><p>Выберите отделку для вашей двери</p></div></div><div className="finish-grid">{(model?.finishes ?? []).map(item => <button key={item.id} className={`finish-tile ${config.finishId === item.id ? 'is-active' : ''}`} onClick={() => { setConfig(previous => ({ ...previous, finishId: item.id })); markTouched('finish') }}><img className="finish-swatch" src={item.image} alt="" loading="lazy" /><strong>{item.name}</strong><small>{item.detail}</small><em>{item.demoSurcharge ? `+ ${money(item.demoSurcharge)}` : 'Без надбавки'}</em></button>)}</div>{!model && <p className="step-hint">Сначала выберите модель.</p>}{model && fieldError('finish', !finish) && <p className="field-error">Выберите отделку.</p>}</div>

                {model && interiorOptions(model.id).length > 0 && <fieldset className="interior-picker">
                  <legend>Внутренний цвет</legend><p>{interiorMaterial}</p>
                  <div>{interiorOptions(model.id).map(color => <label key={color.id}>
                    <input type="radio" name="interior" value={color.id} checked={config.interiorId === color.id}
                      onChange={() => setConfig(previous => ({ ...previous, interiorId: color.id }))} />
                    <i style={{ backgroundColor: color.tone }} /><span>{color.name}</span>
                  </label>)}</div>
                </fieldset>}

                <div className="config-step"><div className="step-heading"><span className="step-number">03</span><div><h3>Размер двери</h3><p>Доступность зависит от модели</p></div></div><div className="size-grid">{sizes.map(item => <button key={item.id} disabled={!model?.sizes.includes(item.id)} className={`choice-button ${config.sizeId === item.id ? 'is-active' : ''}`} onClick={() => { setConfig(previous => ({ ...previous, sizeId: item.id })); markTouched('size') }}><strong>{item.label}</strong><span>{item.demoSurcharge ? `+ ${money(item.demoSurcharge)}` : 'Без надбавки'}</span></button>)}</div>{fieldError('size', !config.sizeId || !model?.sizes.includes(config.sizeId)) && <p className="field-error">Выберите доступный размер.</p>}</div>

                <div className="config-step"><div className="step-heading"><span className="step-number">04</span><div><h3>Дополнительные комплектующие</h3><p>Можно выбрать несколько</p></div></div><div className="accessory-list">{tariffs.accessories.map(item => <label className="accessory-row" key={item.id}><span><input type="checkbox" checked={config.accessoryIds.includes(item.id)} onChange={event => setConfig(previous => ({ ...previous, accessoryIds: event.target.checked ? [...previous.accessoryIds, item.id] : previous.accessoryIds.filter(id => id !== item.id) }))} /><span className="custom-check" aria-hidden="true" />{item.name}</span><strong>+ {money(item.price)}</strong></label>)}</div></div>

                <div className="config-step"><div className="step-heading"><span className="step-number">05</span><div><h3>Доставка и монтаж</h3><p>Укажите, нужны ли доставка и монтаж</p></div></div><div className="service-grid">{([['delivery', 'Доставка', tariffs.delivery], ['installation', 'Монтаж', tariffs.installation]] as const).map(([key, label, price]) => <div className="service-item" key={key}><div><strong>{label}</strong><span>+ {money(price)} при выборе</span></div><div className="segmented"><button className={config[key] === true ? 'is-active' : ''} onClick={() => { setConfig(previous => ({ ...previous, [key]: true })); markTouched(key) }}>Нужно</button><button className={config[key] === false ? 'is-active' : ''} onClick={() => { setConfig(previous => ({ ...previous, [key]: false })); markTouched(key) }}>Не нужно</button></div>{fieldError(key, config[key] === null) && <p className="field-error">Укажите, нужна ли услуга.</p>}</div>)}</div></div>

                <div className="form-actions"><button className="primary-button" onClick={showEstimate}>Показать расчёт <span>↗</span></button><button className="reset-button" onClick={reset}>Сбросить параметры</button></div>{notice && <p className="form-notice" role="status">{notice}</p>}
              </div>
            </div>
          </section>

          <div className="estimate-flow">
          <section className="estimate-section section-pad" id="estimate"><div className="section-head"><div><span className="section-kicker">03 / СМЕТА</span><h2>Всё на своих{' '}<br />местах.</h2></div></div><div className="estimate-layout"><div className="estimate-main"><div className="estimate-paper">
                <div className="estimate-paper-head">
                  <div>
                    <span>DOOR CONFIG / РАСЧЁТ</span>
                    <h3>{model ? `Дверь ${model.name}` : 'Ваша будущая дверь'}</h3>
                    {estimateDetails && <p>{estimateDetails}</p>}
                  </div>
                  <span className="estimate-icon">↗</span>
                </div>
                {estimate.valid ? (
                  <div className="estimate-lines">
                    {(saved?.snapshot.lines ?? updatedQuote?.lines ?? estimate.lines).map(line => (
                      <div className="estimate-line" key={line.key}><span>{line.label}</span><strong>{money(line.amount)}</strong></div>
                    ))}
                  </div>
                ) : model ? (
                  <p className="estimate-incomplete">Завершите настройку в конфигураторе, чтобы получить предварительную стоимость.</p>
                ) : (
                  <div className="estimate-guide">
                    <h4>Соберите свою комплектацию</h4>
                    <p>Выберите модель двери, настройте параметры и получите предварительную стоимость.</p>
                    <ol>
                      <li><span aria-hidden="true">01</span> Выберите модель.</li>
                      <li><span aria-hidden="true">02</span> Настройте отделку и комплектацию.</li>
                      <li><span aria-hidden="true">03</span> Получите расчёт стоимости.</li>
                    </ol>
                    <button type="button" className="estimate-guide-action" onClick={() => scrollTo('catalog')}>Выбрать модель</button>
                  </div>
                )}
                <div className="estimate-total">
                  <span>ПРЕДВАРИТЕЛЬНАЯ СТОИМОСТЬ</span>
                  <strong>{estimate.total === null ? '—' : money(saved?.snapshot.total ?? updatedQuote?.total ?? estimate.total)}</strong>
                </div>
              </div>
              <p className="estimate-note">Предварительный расчёт составлен из выбранных параметров. Итог не является коммерческим предложением.</p>
            </div><aside className="estimate-aside"><span className="aside-label">ДОКУМЕНТ</span><h3>Сохраните{' '}<br />свой выбор.</h3><p>Смета содержит параметры, отдельные позиции стоимости и дату расчёта.</p><button className="dark-button" onClick={savePdf} disabled={!estimate.valid}>Сохранить расчёт в PDF <span>↗</span></button><small>В окне печати выберите «Сохранить как PDF».</small>
              <section className="estimate-comparison" aria-labelledby="estimate-comparison-title">
                <h4 id="estimate-comparison-title">Сравните несколько дверей</h4>
                <p>{comparisonHint}</p>
                <p>Сравните до трёх дверей по виду, параметрам и цене. Можно выбрать одну модель с разными отделками, размерами или комплектующими.</p>
                <button type="button" onClick={showOptionsFromEstimate}>
                  {canCompare ? 'Сравнить двери' : 'Перейти к вариантам'} <span aria-hidden="true">↗</span>
                </button>
              </section>
            </aside></div></section>

          <section className="request-section section-pad" id="selection" aria-labelledby="selection-title">
            <div className="section-head"><div><span className="section-kicker">04 / ВАШ ВЫБОР</span><h2 id="selection-title">Сохраните и сравните</h2></div></div>
            <div className="selection-content">
              <SavedConfigurations catalog={catalog} config={config} editing={editing} onEdit={setEditing}
                storageKey={storageKey} store={variantStore} onStoreChange={setVariantStore} onLoad={loadVariant}
                comparisonOpen={comparisonOpen} onComparisonChange={setComparisonOpen} />
            </div>
          </section>

          <section className="request-section section-pad" id="request" aria-labelledby="request-title">
            <div className="section-head"><div><span className="section-kicker">05 / ЗАЯВКА</span><h2 id="request-title">Оставьте заявку</h2></div></div>
            <div className="request-layout">
              <RequestSummary model={model} finish={finish} config={config} catalog={catalog} total={saved?.snapshot.total ?? updatedQuote?.total ?? estimate.total} valid={estimate.valid} />
              {requestsEnabled && source === 'live' ? saved ? <div className="request-success" role="status"><h3>Заявка № {saved.number} принята</h3><p>Итог по тарифам на момент отправки: {money(saved.snapshot.total)}. Почтовый сервис принял письмо со сметой для менеджера.</p><a href="#estimate">Перейти к смете ↗</a></div> : <form className="request-form" onSubmit={event => void submitRequest(event)}><p>Для отправки заполните контакты. Выбранные модель, отделка, размер и смета уже включены в заявку.</p><div className="request-fields"><label>Имя<input required minLength={2} maxLength={100} value={contact.name} onChange={event => setContact({ ...contact, name: event.target.value })} autoComplete="name" /></label><label>Телефон<input required type="tel" minLength={7} maxLength={25} pattern="[+0-9 \(\)\-]{7,25}" value={contact.phone} onChange={event => setContact({ ...contact, phone: event.target.value })} autoComplete="tel" /></label><label>Email (необязательно)<input type="email" maxLength={254} value={contact.email} onChange={event => setContact({ ...contact, email: event.target.value })} autoComplete="email" /></label><label className="request-wide">Комментарий<textarea maxLength={2000} rows={4} value={contact.comment} onChange={event => setContact({ ...contact, comment: event.target.value })} /></label></div><label className="request-consent"><input type="checkbox" required checked={contact.consent} onChange={event => setContact({ ...contact, consent: event.target.checked })} /> Согласен на обработку персональных данных для ответа на заявку.</label><label className="request-trap" aria-hidden="true">Сайт<input tabIndex={-1} autoComplete="off" value={contact.website} onChange={event => setContact({ ...contact, website: event.target.value })} /></label>{updatedQuote && <div role="status" className="request-wide">
              <strong>Стоимость изменилась. Проверьте обновлённую смету.</strong>
              <ul>{updatedQuote.lines.map(line => <li key={line.key}>{line.label} · {money(line.amount)}</li>)}</ul>
              <p>Новый итог: <strong>{money(updatedQuote.total)}</strong>. Для отправки подтвердите эту стоимость.</p>
            </div>}{submitError && <p className="request-error" role="alert">{submitError}</p>}<button className="primary-button" type="submit" disabled={!estimate.valid || submitting}>{submitting ? 'Отправляем…' : updatedQuote ? 'Подтвердить стоимость и отправить' : 'Отправить заявку ↗'}</button></form> : <p className="request-message">Приём заявок временно отключён.</p>}
            </div>
          </section>
          </div>
        </main>
        <footer><a className="brand" href="#top"><span className="brand-mark">D<span>.</span></span><span>DOOR <b>CONFIG</b></span></a><span>Предварительный расчёт. Не является публичной офертой.</span><span>© {new Date().getFullYear()} DOOR CONFIG</span></footer>
      </div>

      <div className="mobile-total-bar"><div><small>ПРЕДВАРИТЕЛЬНО</small><strong>{estimate.total === null ? '—' : money(saved?.snapshot.total ?? updatedQuote?.total ?? estimate.total)}</strong></div><button onClick={showEstimate}>К расчёту ↗</button></div>

      {estimate.valid && <div className="print-sheet"><div className="print-header"><span>DOOR CONFIG</span><small>РАСЧЁТ КОНФИГУРАЦИИ</small></div><div className="print-meta"><span>№ {saved?.number ?? documentNumber}</span><span>{saved ? new Intl.DateTimeFormat('ru-RU', { dateStyle: 'long' }).format(new Date(saved.createdAt)) : documentDate}</span></div><h1>Ваша входная дверь</h1><div className="print-intro"><DoorVisual model={model!} finish={finish!} compact exteriorImage={saved?.snapshot.image} /><div><span>МОДЕЛЬ</span><h2>{saved?.snapshot.model ?? estimate.modelName}</h2><p><b>Отделка:</b> {saved?.snapshot.finish ?? estimate.finishName}</p><p><b>Внутренняя панель:</b> {saved?.snapshot.interior ?? inner?.name ?? 'Не выбран'}</p>{spec && <p>{saved?.snapshot.construction ?? constructionSummary(spec)}</p>}<p><b>Размер:</b> {saved?.snapshot.size ?? estimate.sizeName}</p><p className="print-note">Демонстрационная 2D-визуализация вымышленной модели.</p></div></div><h3>Детализация стоимости</h3><div className="print-lines">{(saved?.snapshot.lines ?? updatedQuote?.lines ?? estimate.lines).map(line => <div key={line.key}><span>{line.label}</span><strong>{money(line.amount)}</strong></div>)}</div><div className="print-total"><span>Общая предварительная стоимость</span><strong>{money(saved?.snapshot.total ?? updatedQuote?.total ?? estimate.total!)}</strong></div><p className="print-disclaimer">Предварительный расчёт. Не является публичной офертой. Итоговую стоимость уточняют после замера.</p></div>}
    </>
  )
}

export default App




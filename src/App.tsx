import { useEffect, useMemo, useRef, useState } from 'react'
import type { DoorModel, Finish } from './data/catalog.ts'
import type { CatalogData } from './data/catalogData.ts'
import { interiorImageManifest } from './data/imageManifest.ts'
import { marketReferences } from './data/marketReferences.ts'
import { calculateEstimate, emptyConfiguration } from './lib/pricing.ts'
import type { Configuration } from './lib/pricing.ts'
import { supabase } from './lib/supabase.ts'

type SavedRequest = { number: string; createdAt: string; snapshot: { model: string; finish: string; size: string; image: string; lines: { key: string; label: string; amount: number }[]; total: number }; notificationSent: boolean }

const money = (value: number) => new Intl.NumberFormat('ru-RU').format(value) + ' ₽'
const requestsEnabled = import.meta.env.VITE_DOOR_REQUESTS_ENABLED === 'true'

function DoorVisual({ model, finish, compact = false, interactive = false, hoverInterior = false, exteriorImage }: { model: DoorModel; finish: Finish; compact?: boolean; interactive?: boolean; hoverInterior?: boolean; exteriorImage?: string }) {
  const [side, setSide] = useState<'exterior' | 'interior'>('exterior')
  const interior = interiorImageManifest[model.assetModelId]
  useEffect(() => setSide('exterior'), [model.id])
  return (
    <figure className={`door-scene ${compact ? 'door-scene--compact' : ''} ${interactive ? 'door-scene--two-sided' : ''}`} data-side={side} onPointerEnter={interactive && hoverInterior ? event => { if (event.pointerType === 'mouse') setSide('interior') } : undefined} onPointerLeave={interactive && hoverInterior ? event => { if (event.pointerType === 'mouse') setSide('exterior') } : undefined}>
      <img className="door-image--exterior" src={exteriorImage ?? finish.image} alt={`Наружная сторона двери ${model.name}, отделка ${finish.name}`} loading={compact ? 'lazy' : 'eager'} decoding="async" />
      {interactive && <img className="door-image--interior" src={interior} alt={`Внутренняя сторона двери ${model.name}`} loading={compact ? 'lazy' : 'eager'} decoding="async" />}
      <figcaption className="scene-caption">Демонстрационная 2D-визуализация</figcaption>
      {interactive && <><span className="side-hint">Вид изнутри</span><div className="side-switch" aria-label={`Сторона двери ${model.name}`}><button type="button" className={side === 'exterior' ? 'is-active' : ''} aria-pressed={side === 'exterior'} onClick={() => setSide('exterior')}>Снаружи</button><button type="button" className={side === 'interior' ? 'is-active' : ''} aria-pressed={side === 'interior'} onClick={() => setSide('interior')}>Изнутри</button></div></>}
    </figure>
  )
}

function RequestSummary({ model, finish, config, catalog, total, valid }: { model?: DoorModel; finish?: Finish; config: Configuration; catalog: CatalogData; total: number | null; valid: boolean }) {
  const [side, setSide] = useState<'exterior' | 'interior'>('exterior')
  const size = catalog.sizes.find(item => item.id === config.sizeId && model?.sizes.includes(item.id))
  const accessories = catalog.accessories.filter(item => config.accessoryIds.includes(item.id))
  return <aside className="request-summary" aria-label="Ваша конфигурация">
    <header className="request-summary-head"><span>ВАША КОНФИГУРАЦИЯ</span><h3>{model?.name ?? 'Выберите модель'}</h3></header>
    {model ? <>
      <div className="request-summary-switch" aria-label="Сторона двери"><button type="button" aria-pressed={side === 'exterior'} className={side === 'exterior' ? 'is-active' : ''} onClick={() => setSide('exterior')}>Снаружи</button><button type="button" aria-pressed={side === 'interior'} className={side === 'interior' ? 'is-active' : ''} onClick={() => setSide('interior')}>Изнутри</button></div>
      <div className="request-summary-photos">
        <figure className={`request-summary-photo ${side === 'exterior' ? 'is-current' : ''}`}>{finish ? <img src={finish.image} alt={`Наружная сторона двери ${model.name}, отделка ${finish.name}`} loading="lazy" /> : <div className="request-summary-photo-empty">Выберите наружную отделку</div>}<figcaption>Снаружи</figcaption></figure>
        <figure className={`request-summary-photo ${side === 'interior' ? 'is-current' : ''}`}><img src={interiorImageManifest[model.assetModelId]} alt={`Внутренняя сторона двери ${model.name}`} loading="lazy" /><figcaption>Изнутри</figcaption></figure>
      </div>
    </> : <p className="request-summary-empty">Выберите модель, чтобы увидеть обе стороны двери.</p>}
    {(model || accessories.length > 0 || config.delivery !== null || config.installation !== null) && <dl className="request-summary-details">
      {model && <><dt>Модель</dt><dd>{model.name}</dd></>}
      {finish && <><dt>Наружная отделка</dt><dd>{finish.name}</dd></>}
      {size && <><dt>Размер</dt><dd>{size.label}</dd></>}
      {(model || accessories.length > 0) && <><dt>Комплектация</dt><dd>{accessories.length ? accessories.map(item => item.name).join(', ') : 'Без дополнительных опций'}</dd></>}
      {(model || config.delivery !== null) && <><dt>Доставка</dt><dd>{config.delivery === null ? 'Не выбрано' : config.delivery ? 'Нужна' : 'Не требуется'}</dd></>}
      {(model || config.installation !== null) && <><dt>Монтаж</dt><dd>{config.installation === null ? 'Не выбрано' : config.installation ? 'Нужен' : 'Не требуется'}</dd></>}
    </dl>}
    <div className="request-summary-total"><span>ПРЕДВАРИТЕЛЬНАЯ СТОИМОСТЬ</span><strong>{valid && total !== null ? money(total) : 'Завершите настройку двери'}</strong></div>
  </aside>
}

function App({ catalog, source }: { catalog: CatalogData; source: 'demo' | 'live' }) {
  const { models, sizes } = catalog
  const tariffs = catalog
  const [config, setConfig] = useState<Configuration>(emptyConfiguration)
  const [attempted, setAttempted] = useState(false)
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [notice, setNotice] = useState('')
  const [contact, setContact] = useState({ name: '', phone: '', email: '', comment: '', consent: false, website: '' })
  const [formStartedAt] = useState(() => Date.now())
  const [submitting, setSubmitting] = useState(false)
  const submitInFlight = useRef(false)
  const [submitError, setSubmitError] = useState('')
  const [saved, setSaved] = useState<SavedRequest | null>(null)
  const estimate = useMemo(() => calculateEstimate(config, catalog), [config, catalog])
  const model = models.find(item => item.id === config.modelId)
  const finish = model?.finishes.find(item => item.id === config.finishId)
  const previewModel = model ?? models[0]
  const previewFinish = finish ?? previewModel.finishes[0]
  const issuedAt = useMemo(() => new Date(), [])
  const documentNumber = useMemo(() => `DC-${issuedAt.toISOString().slice(0, 10).replaceAll('-', '')}-${Math.floor(Math.random() * 9000 + 1000)}`, [issuedAt])
  const documentDate = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'long' }).format(issuedAt)

  useEffect(() => { setSaved(null); setSubmitError('') }, [config])

  const submitRequest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!requestsEnabled || !supabase || source !== 'live' || !estimate.valid || !contact.consent || submitInFlight.current) return
    submitInFlight.current = true
    setSubmitting(true); setSubmitError('')
    try {
      const { data, error } = await supabase.functions.invoke('submit-door-request', {
        body: { configuration: config, contact: { name: contact.name, phone: contact.phone, email: contact.email, comment: contact.comment, consent: contact.consent }, website: contact.website, startedAt: formStartedAt },
      })
      if (error) {
        const body = await error.context?.json?.().catch(() => null)
        throw new Error(body?.error ?? 'Не удалось сохранить заявку. Повторите попытку.')
      }
      if (!data?.number || !data?.snapshot || !Number.isSafeInteger(data.snapshot.total)) throw new Error('Сервер вернул неполный расчёт.')
      setSaved(data as SavedRequest)
      setNotice('Заявка сохранена. Номер расчёта: ' + data.number)
    } catch (error) { setSubmitError(error instanceof Error ? error.message : 'Не удалось отправить заявку.') }
    finally { submitInFlight.current = false; setSubmitting(false) }
  }

  useEffect(() => {
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
  }, [catalog])

  const markTouched = (key: string) => setTouched(previous => ({ ...previous, [key]: true }))
  const fieldError = (key: string, invalid: boolean) => invalid && (attempted || touched[key])
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  const selectModel = (next: DoorModel) => {
    setConfig({ ...emptyConfiguration, modelId: next.id })
    setAttempted(false)
    setTouched({ model: true })
    setNotice('')
    requestAnimationFrame(() => scrollTo('configurator'))
  }

  const reset = () => {
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
          <nav aria-label="Основная навигация"><a href="#catalog">Модели</a><a href="#configurator">Конфигуратор</a><a href="#about">О проекте</a></nav>
          <button className="header-action" onClick={() => scrollTo('catalog')}>Начать расчёт <span>↗</span></button>
        </header>
        {source === 'demo' && <div className="catalog-mode-banner" role="status">Локальный режим: Supabase не подключён. Показаны исходные цены; изменения через /admin пока недоступны.</div>}

        <main id="top">
          <section className="hero">
            <div className="hero-copy">
              <div className="eyebrow"><span className="eyebrow-line" /> ВИЗУАЛЬНЫЙ КОНФИГУРАТОР ДВЕРЕЙ</div>
              <h1>Дверь, которая<br /><em>задаёт тон</em><br />вашему дому.</h1>
              <p>Подберите модель, отделку и комплектацию. Смотрите предварительную стоимость сразу и сохраняйте подробный расчёт.</p>
              <button className="primary-button" onClick={() => scrollTo('catalog')}>Рассчитать стоимость <span>↗</span></button>
              <div className="hero-footnote"><span className="footnote-dot" /> Предварительный расчёт · стоимость уточняется после замера</div>
            </div>
            <div className="hero-visual">
              <div className="hero-visual-top"><span>01 / {String(models.length).padStart(2, '0')}</span><span>КОЛЛЕКЦИЯ 2026</span></div>
              <DoorVisual model={models[0]} finish={models[0].finishes[0]} />
              <div className="hero-visual-bottom"><div><span>МОДЕЛЬ КОЛЛЕКЦИИ</span><strong>{models[0].name}</strong></div><span className="visual-arrow">↗</span></div>
            </div>
          </section>

          <section className="intro-strip" aria-label="Возможности"><div><strong>{models.length}</strong><span>моделей в коллекции</span></div><div><strong>{models[0].finishes.length}</strong><span>отделки модели</span></div><p>От первого впечатления<br />до точного решения.</p></section>

          <section className="catalog section-pad" id="catalog">
            <div className="section-head"><div><span className="section-kicker">01 / КОЛЛЕКЦИЯ</span><h2>Найдите свою<br /><em>дверь.</em></h2></div><p>Каждая модель имеет свой характер. Выберите её, чтобы перейти к настройке.</p></div>
            <div className="catalog-grid">
              {models.map((item, index) => <article className={`model-card ${config.modelId === item.id ? 'model-card--selected' : ''}`} key={item.id}>
                <div className="card-visual"><DoorVisual model={item} finish={item.finishes[0]} compact interactive hoverInterior /></div>
                <div className="card-body">
                  <div className="card-meta"><span className="card-index">{String(index + 1).padStart(2, '0')} / {String(models.length).padStart(2, '0')}</span><span className="card-tag">{item.tagline}</span></div>
                  <div className="card-title-row"><h3>{item.name}</h3><span>↗</span></div>
                  <p>{item.description}</p>
                  <div className="card-features">{item.features.slice(0, 2).map(feature => <span key={feature}>{feature}</span>)}</div>
                  {marketReferences[item.id] && <div className="market-reference"><span>ОРИЕНТИР ПО ПРАЙСУ · МОСКВА · {marketReferences[item.id].checkedOn}</span><p>Сопоставимая категория: <a href={marketReferences[item.id].sourceUrl} target="_blank" rel="noopener noreferrer">Torex {marketReferences[item.id].series} ↗</a> от {money(marketReferences[item.id].publishedFrom)}. Цена другой комплектации.</p></div>}
                  <div className="card-bottom"><div><small>БАЗОВАЯ СТОИМОСТЬ</small><strong>{money(item.demoBasePrice)}</strong></div><button onClick={() => selectModel(item)} aria-label={`Выбрать модель ${item.name}`}>{config.modelId === item.id ? 'Выбрана' : 'Выбрать'} <span>→</span></button></div>
                </div>
              </article>)}
            </div>
          </section>

          <section className="config-section section-pad" id="configurator">
            <div className="section-head section-head--light"><div><span className="section-kicker">02 / КОНФИГУРАТОР</span><h2>Создайте<br /><em>свою конфигурацию.</em></h2></div><p>Каждый выбор отражается в смете. Окончательную стоимость уточняют после замера.</p></div>
            <div className="config-layout">
              <aside className={`preview-panel ${model ? '' : 'preview-panel--example'}`}><div className="preview-top"><span>ВАШ ВЫБОР</span><strong>{model?.name ?? 'Пример визуализации'}</strong></div><DoorVisual model={previewModel} finish={previewFinish} interactive /><div className="preview-bottom"><div><span>ОТДЕЛКА</span><strong>{finish?.name ?? 'Не выбрана'}</strong></div><span>2D-визуализация</span></div></aside>
              <div className="config-form">
                <div className="config-step"><div className="step-heading"><span className="step-number">01</span><div><h3>Модель двери</h3><p>Выберите основу вашей конфигурации</p></div></div><div className="select-grid select-grid--models">{models.map(item => <button key={item.id} className={`select-tile ${config.modelId === item.id ? 'is-active' : ''}`} onClick={() => selectModel(item)}><strong>{item.name}</strong><span>от {money(item.demoBasePrice)}</span></button>)}</div>{fieldError('model', !model) && <p className="field-error">Выберите модель двери.</p>}</div>

                <div className="config-step"><div className="step-heading"><span className="step-number">02</span><div><h3>Наружная отделка</h3><p>Выберите отделку для вашей двери</p></div></div><div className="finish-grid">{(model?.finishes ?? []).map(item => <button key={item.id} className={`finish-tile ${config.finishId === item.id ? 'is-active' : ''}`} onClick={() => { setConfig(previous => ({ ...previous, finishId: item.id })); markTouched('finish') }}><img className="finish-swatch" src={item.image} alt="" loading="lazy" /><strong>{item.name}</strong><small>{item.detail}</small><em>{item.demoSurcharge ? `+ ${money(item.demoSurcharge)}` : 'Без надбавки'}</em></button>)}</div>{!model && <p className="step-hint">Сначала выберите модель.</p>}{model && fieldError('finish', !finish) && <p className="field-error">Выберите отделку.</p>}</div>

                <div className="config-step"><div className="step-heading"><span className="step-number">03</span><div><h3>Размер двери</h3><p>Доступность зависит от модели</p></div></div><div className="size-grid">{sizes.map(item => <button key={item.id} disabled={!model?.sizes.includes(item.id)} className={`choice-button ${config.sizeId === item.id ? 'is-active' : ''}`} onClick={() => { setConfig(previous => ({ ...previous, sizeId: item.id })); markTouched('size') }}><strong>{item.label}</strong><span>{item.demoSurcharge ? `+ ${money(item.demoSurcharge)}` : 'Без надбавки'}</span></button>)}</div>{fieldError('size', !config.sizeId || !model?.sizes.includes(config.sizeId)) && <p className="field-error">Выберите доступный размер.</p>}</div>

                <div className="config-step"><div className="step-heading"><span className="step-number">04</span><div><h3>Дополнительные комплектующие</h3><p>Можно выбрать несколько</p></div></div><div className="accessory-list">{tariffs.accessories.map(item => <label className="accessory-row" key={item.id}><span><input type="checkbox" checked={config.accessoryIds.includes(item.id)} onChange={event => setConfig(previous => ({ ...previous, accessoryIds: event.target.checked ? [...previous.accessoryIds, item.id] : previous.accessoryIds.filter(id => id !== item.id) }))} /><span className="custom-check" aria-hidden="true" />{item.name}</span><strong>+ {money(item.price)}</strong></label>)}</div></div>

                <div className="config-step"><div className="step-heading"><span className="step-number">05</span><div><h3>Доставка и монтаж</h3><p>Укажите, нужны ли доставка и монтаж</p></div></div><div className="service-grid">{([['delivery', 'Доставка', tariffs.delivery], ['installation', 'Монтаж', tariffs.installation]] as const).map(([key, label, price]) => <div className="service-item" key={key}><div><strong>{label}</strong><span>+ {money(price)} при выборе</span></div><div className="segmented"><button className={config[key] === true ? 'is-active' : ''} onClick={() => { setConfig(previous => ({ ...previous, [key]: true })); markTouched(key) }}>Нужно</button><button className={config[key] === false ? 'is-active' : ''} onClick={() => { setConfig(previous => ({ ...previous, [key]: false })); markTouched(key) }}>Не нужно</button></div>{fieldError(key, config[key] === null) && <p className="field-error">Укажите, нужна ли услуга.</p>}</div>)}</div></div>

                <div className="form-actions"><button className="primary-button" onClick={showEstimate}>Показать расчёт <span>↗</span></button><button className="reset-button" onClick={reset}>Сбросить параметры</button></div>{notice && <p className="form-notice" role="status">{notice}</p>}
              </div>
            </div>
          </section>

          <section className="estimate-section section-pad" id="estimate"><div className="section-head"><div><span className="section-kicker">03 / СМЕТА</span><h2>Всё на своих<br /><em>местах.</em></h2></div><p>Предварительный расчёт составлен из выбранных параметров. Итог не является коммерческим предложением.</p></div><div className="estimate-layout"><div className="estimate-paper"><div className="estimate-paper-head"><div><span>DOOR CONFIG / РАСЧЁТ</span><h3>{estimate.valid ? `Дверь ${estimate.modelName}` : 'Ваша будущая дверь'}</h3><p>{estimate.valid ? `${estimate.finishName} · ${estimate.sizeName}` : 'Выберите модель, отделку, размер и услуги, чтобы увидеть смету.'}</p></div><span className="estimate-icon">↗</span></div>{estimate.valid ? <div className="estimate-lines">{(saved?.snapshot.lines ?? estimate.lines).map(line => <div className="estimate-line" key={line.key}><span>{line.label}</span><strong>{money(line.amount)}</strong></div>)}</div> : <div className="estimate-empty">Расчёт появится здесь после выбора всех обязательных параметров.</div>}<div className="estimate-total"><span>ПРЕДВАРИТЕЛЬНАЯ СТОИМОСТЬ</span><strong>{estimate.total === null ? '—' : money(saved?.snapshot.total ?? estimate.total)}</strong></div></div><aside className="estimate-aside"><span className="aside-label">ДОКУМЕНТ</span><h3>Сохраните<br />свой выбор.</h3><p>Смета содержит параметры, отдельные позиции стоимости и дату расчёта.</p><button className="dark-button" onClick={savePdf} disabled={!estimate.valid}>Скачать расчёт PDF <span>↗</span></button><small>В окне печати выберите «Сохранить как PDF».</small></aside></div></section>

          <section className={`request-section section-pad ${requestsEnabled && source === 'live' ? '' : 'request-section--demo'}`} id="request"><div className="section-head"><div><span className="section-kicker">04 / {requestsEnabled && source === 'live' ? 'ЗАЯВКА' : 'ВАШ РАСЧЁТ'}</span><h2>{requestsEnabled && source === 'live' ? <>Сохраните расчёт<br /><em>и оставьте заявку.</em></> : <>Сохраните<br /><em>свой выбор.</em></>}</h2></div></div>
            <div className="request-layout">
              <RequestSummary model={model} finish={finish} config={config} catalog={catalog} total={estimate.total} valid={estimate.valid} />
            {requestsEnabled && source === 'live' ? saved ? <div className="request-success" role="status"><h3>Заявка № {saved.number} сохранена</h3><p>Итог по тарифам на момент отправки: {money(saved.snapshot.total)}. {saved.notificationSent ? 'Уведомление администратору отправлено.' : 'Письмо администратору не подтверждено; заявка доступна в админке.'}</p><button className="dark-button" onClick={savePdf}>Скачать PDF ↗</button></div> : <form className="request-form" onSubmit={event => void submitRequest(event)}><p>Для отправки заполните контакты. Выбранные модель, отделка, размер и смета уже включены в заявку.</p><div className="request-fields"><label>Имя<input required minLength={2} maxLength={100} value={contact.name} onChange={event => setContact({ ...contact, name: event.target.value })} autoComplete="name" /></label><label>Телефон<input required type="tel" minLength={7} maxLength={25} pattern="[+0-9 ()-]{7,25}" value={contact.phone} onChange={event => setContact({ ...contact, phone: event.target.value })} autoComplete="tel" /></label><label>Email (необязательно)<input type="email" maxLength={254} value={contact.email} onChange={event => setContact({ ...contact, email: event.target.value })} autoComplete="email" /></label><label className="request-wide">Комментарий<textarea maxLength={2000} rows={4} value={contact.comment} onChange={event => setContact({ ...contact, comment: event.target.value })} /></label></div><label className="request-consent"><input type="checkbox" required checked={contact.consent} onChange={event => setContact({ ...contact, consent: event.target.checked })} /> Согласен на обработку персональных данных для ответа на заявку.</label><label className="request-trap" aria-hidden="true">Сайт<input tabIndex={-1} autoComplete="off" value={contact.website} onChange={event => setContact({ ...contact, website: event.target.value })} /></label>{submitError && <p className="request-error" role="alert">{submitError}</p>}<button className="primary-button" type="submit" disabled={!estimate.valid || submitting}>{submitting ? 'Сохраняем…' : 'Отправить заявку ↗'}</button></form> : <div className="request-demo"><p className="request-demo-lead">Модель, отделка и комплектация собраны в одном расчёте. Сохраните его для сравнения и дальнейшего выбора.</p><button className="dark-button" type="button" onClick={savePdf} disabled={!estimate.valid}>Сохранить расчёт PDF <span aria-hidden="true">↗</span></button><p className="request-demo-note">В окне печати выберите «Сохранить как PDF».</p><p className="request-demo-status">Демонстрационная версия. Отправка заявок временно недоступна</p></div>}
            </div>
          </section>
          <section className="about-section section-pad" id="about">
            <div className="about-copy">
              <span className="section-kicker">DOOR CONFIG / ДЕТАЛИ</span>
              <h2>Две стороны<br /><em>одного решения.</em></h2>
              <p>Снаружи — характер. Изнутри — уют. Важна каждая деталь вашего пространства.</p>
            </div>
            <div className="about-pair" aria-label="Дверь Monolith с двух сторон">
              <figure className="about-photo">
                <img src="/images/catalog-2026/dc-04-stone__graphite__exterior.webp" alt="Дверь Monolith, наружная сторона в отделке графит" loading="lazy" width="960" height="1280" />
                <figcaption>Снаружи</figcaption>
              </figure>
              <figure className="about-photo about-photo--interior">
                <img src="/images/catalog-2026/dc-04-stone__interior.webp" alt="Дверь Monolith, внутренняя сторона" loading="lazy" width="960" height="1280" />
                <figcaption>Изнутри</figcaption>
              </figure>
            </div>
            <a className="about-link" href="#catalog">Вернуться к выбору <span aria-hidden="true">↗</span></a>
          </section>
        </main>
        <footer><a className="brand" href="#top"><span className="brand-mark">D<span>.</span></span><span>DOOR <b>CONFIG</b></span></a><span>Предварительный расчёт. Не является публичной офертой.</span><span>© {new Date().getFullYear()} DOOR CONFIG</span></footer>
      </div>

      <div className="mobile-total-bar"><div><small>ПРЕДВАРИТЕЛЬНО</small><strong>{estimate.total === null ? '—' : money(saved?.snapshot.total ?? estimate.total)}</strong></div><button onClick={estimate.valid ? savePdf : showEstimate}>{estimate.valid ? 'PDF ↗' : 'К расчёту ↗'}</button></div>

      {estimate.valid && <div className="print-sheet"><div className="print-header"><span>DOOR CONFIG</span><small>РАСЧЁТ КОНФИГУРАЦИИ</small></div><div className="print-meta"><span>№ {saved?.number ?? documentNumber}</span><span>{saved ? new Intl.DateTimeFormat('ru-RU', { dateStyle: 'long' }).format(new Date(saved.createdAt)) : documentDate}</span></div><h1>Ваша входная дверь</h1><div className="print-intro"><DoorVisual model={model!} finish={finish!} compact exteriorImage={saved?.snapshot.image} /><div><span>МОДЕЛЬ</span><h2>{saved?.snapshot.model ?? estimate.modelName}</h2><p><b>Отделка:</b> {saved?.snapshot.finish ?? estimate.finishName}</p><p><b>Размер:</b> {saved?.snapshot.size ?? estimate.sizeName}</p><p className="print-note">Демонстрационная 2D-визуализация вымышленной модели.</p></div></div><h3>Детализация стоимости</h3><div className="print-lines">{(saved?.snapshot.lines ?? estimate.lines).map(line => <div key={line.key}><span>{line.label}</span><strong>{money(line.amount)}</strong></div>)}</div><div className="print-total"><span>Общая предварительная стоимость</span><strong>{money(saved?.snapshot.total ?? estimate.total!)}</strong></div><p className="print-disclaimer">Предварительный расчёт. Не является публичной офертой. Итоговую стоимость уточняют после замера.</p></div>}
    </>
  )
}

export default App




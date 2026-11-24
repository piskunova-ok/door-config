import { useEffect, useRef, useState } from 'react'
import { interiorImageManifest } from './data/imageManifest.ts'
import type { CatalogData } from './data/catalogData.ts'
import { calculateEstimate, type Configuration } from './lib/pricing.ts'
import { readVariants, slots, writeVariants, type Slot, type Variant } from './lib/savedConfigurations.ts'

type Props = {
  catalog: CatalogData
  config: Configuration
  storageKey: string
  store: ReturnType<typeof readVariants>
  onStoreChange: (store: ReturnType<typeof readVariants>) => void
  editing: Slot | null
  onEdit: (slot: Slot | null) => void
  onLoad: (variant: Variant) => void
  comparisonOpen: boolean
  onComparisonChange: (open: boolean) => void
}

const rubles = (n: number) => n.toLocaleString('ru-RU') + ' ₽'
const fields = ['Модель', 'Наружная отделка', 'Размер', 'Комплектующие', 'Доставка', 'Монтаж', 'Итоговая стоимость']
const unavailable = (id: string | null) => 'Недоступно (' + id + ')'

function describe(variant: Variant, catalog: CatalogData) {
  const c = variant.config
  const estimate = calculateEstimate(c, catalog)
  const model = catalog.models.find(m => m.id === c.modelId)
  const finish = model?.finishes.find(f => f.id === c.finishId)
  const size = catalog.sizes.find(s => s.id === c.sizeId && model?.sizes.includes(s.id))
  const accessories = [...new Set(c.accessoryIds)].sort().map(id => catalog.accessories.find(a => a.id === id)?.name ?? unavailable(id))
  const values = [model?.name ?? unavailable(c.modelId), finish?.name ?? unavailable(c.finishId), size?.label ?? unavailable(c.sizeId),
    accessories.join(', ') || 'Без дополнений', c.delivery ? 'Нужна' : 'Не нужна', c.installation ? 'Нужен' : 'Не нужен',
    estimate.total === null ? 'Требует исправления' : rubles(estimate.total)]
  return {
    variant,
    title: 'Вариант ' + variant.slot + ' — ' + (model?.name ?? variant.modelName),
    model,
    finish,
    values,
    total: estimate.total,
  }
}

type VariantDetails = ReturnType<typeof describe>

function ComparisonDoor({ entry, minimum, onLoad }: {
  entry: VariantDetails
  minimum: number
  onLoad: (variant: Variant) => void
}) {
  const [side, setSide] = useState<'exterior' | 'interior'>('exterior')
  const [failedImage, setFailedImage] = useState<string>()
  const { variant, model, finish, total } = entry
  const interior = model && interiorImageManifest[model.assetModelId]
  const image = side === 'interior' ? interior : finish?.image
  const alt = side === 'interior'
    ? `Внутренняя сторона двери ${model?.name}`
    : `Наружная сторона двери ${model?.name}, отделка «${finish?.name}»`
  const lowest = total !== null && total === minimum

  return (
    <article className="comparison-card" aria-label={'Вариант ' + variant.slot}>
      <header>
        <p>Вариант {variant.slot}</p>
        <h3>{model?.name ?? variant.modelName}</h3>
      </header>
      <div className="comparison-image">
        {image && failedImage !== image
          ? <img src={image} alt={alt} onError={() => setFailedImage(image)} />
          : <p>{!model ? 'Модель недоступна' : !finish && side === 'exterior' ? 'Отделка недоступна' : 'Фото недоступно'}</p>}
      </div>
      <div className="comparison-sides" role="group" aria-label={'Сторона двери, вариант ' + variant.slot}>
        <button type="button" aria-pressed={side === 'exterior'} onClick={() => setSide('exterior')}>Снаружи</button>
        <button type="button" aria-pressed={side === 'interior'} onClick={() => setSide('interior')} disabled={!interior}>Изнутри</button>
      </div>
      <p className="comparison-finish">{finish?.name ?? 'Отделка недоступна'}</p>
      {total === null
        ? <p className="variant-warning">Параметры устарели. Загрузите вариант, чтобы исправить их.</p>
        : <div className={lowest ? 'comparison-price is-lowest' : 'comparison-price'}>
          <strong>{rubles(total)}</strong>
          <small>{lowest ? 'Минимальная стоимость' : '+' + rubles(total - minimum)}</small>
        </div>}
      <button type="button" className="comparison-load"
        aria-label={'Загрузить в конфигуратор, вариант ' + variant.slot} onClick={() => onLoad(variant)}>
        Загрузить в конфигуратор
      </button>
    </article>
  )
}

function DoorComparison({ cards, onBack, onLoad }: {
  cards: VariantDetails[]
  onBack: () => void
  onLoad: (variant: Variant) => void
}) {
  const heading = useRef<HTMLHeadingElement>(null)
  const minimum = Math.min(...cards.flatMap(card => card.total === null ? [] : [card.total]))

  useEffect(() => {
    heading.current?.focus({ preventScroll: true })
    document.getElementById('request')?.scrollIntoView({ block: 'start', behavior: 'instant' })
  }, [])

  return (
    <section className="variant-comparison" aria-labelledby="comparison-title" data-count={cards.length}>
      <header className="comparison-header">
        <h2 id="comparison-title" ref={heading} tabIndex={-1}>Сравнение дверей</h2>
        <button type="button" onClick={onBack}>Вернуться к вариантам</button>
      </header>
      <p className="comparison-hint" id="comparison-hint">Прокрутите вбок, чтобы увидеть все двери и параметры.</p>
      <div className="comparison-scroll" tabIndex={0} role="region" aria-labelledby="comparison-title" aria-describedby="comparison-hint">
        <div className="comparison-board">
          <div className="comparison-photos">
            {cards.map(entry => <ComparisonDoor key={entry.variant.slot} entry={entry} minimum={minimum} onLoad={onLoad} />)}
          </div>
          <table>
            <caption>Сравнение комплектаций</caption>
            <colgroup><col className="comparison-parameter" />{cards.map(c => <col key={c.variant.slot} />)}</colgroup>
            <thead>
              <tr><th scope="col">Параметр</th>{cards.map(c => <th scope="col" key={c.variant.slot}>{c.title}</th>)}</tr>
            </thead>
            <tbody>
              {fields.map((field, i) => (
                <tr key={field} className={new Set(cards.map(c => c.values[i])).size > 1 ? 'differs' : undefined}>
                  <th scope="row">{field}</th>
                  {cards.map(c => {
                    const priceRow = i === fields.length - 1
                    const lowest = priceRow && c.total !== null && c.total === minimum
                    return <td key={c.variant.slot} className={lowest ? 'is-lowest' : undefined}>
                      {priceRow ? <strong>{c.values[i]}</strong> : c.values[i]}
                      {priceRow && c.total !== null && <small>{lowest ? 'Минимальная стоимость' : '+' + rubles(c.total - minimum)}</small>}
                    </td>
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

export default function SavedConfigurations({ catalog, config, storageKey, store, onStoreChange, editing, onEdit, onLoad, comparisonOpen, onComparisonChange }: Props) {
  const [message, setMessage] = useState('')
  const compareButton = useRef<HTMLButtonElement>(null)
  const current = calculateEstimate(config, catalog)
  const cards = store.variants.map(v => describe(v, catalog))
  const free = slots.find(slot => !cards.some(c => c.variant.slot === slot))

  function persist(next: Variant[], success: string) {
    try {
      onStoreChange(writeVariants(storageKey, store, next))
      setMessage(success)
      return true
    } catch (error) {
      const fresh = readVariants(storageKey)
      onStoreChange(fresh)
      if (fresh.raw !== store.raw) onEdit(null)
      setMessage(fresh.raw !== store.raw && error instanceof Error ? error.message : 'Не удалось записать изменения. Проверьте доступ к хранилищу браузера.')
      return false
    }
  }

  function save(slot: Slot | undefined) {
    if (!slot || !current.valid || !current.modelName) return
    const item = { slot, config, modelName: current.modelName }
    const next = [...store.variants.filter(v => v.slot !== slot), item].sort((a, b) => a.slot - b.slot)
    if (persist(next, 'Вариант ' + slot + ' сохранён.')) onEdit(null)
  }

  if (comparisonOpen) {
    return <DoorComparison cards={cards} onLoad={onLoad} onBack={() => {
      onComparisonChange(false)
      requestAnimationFrame(() => compareButton.current?.focus())
    }} />
  }

  return (
    <section className="variants" aria-labelledby="variants-title">
      <h3 id="variants-title" tabIndex={-1}>Сохранённые варианты</h3>
      <div className="variant-actions">
        {editing !== null && <button disabled={!current.valid} onClick={() => save(editing)}>Обновить вариант {editing}</button>}
        <button disabled={!free || !current.valid} onClick={() => save(free)}>{editing === null ? 'Сохранить вариант' : 'Сохранить как новый'}</button>
        <button ref={compareButton} type="button" disabled={cards.length < 2}
          aria-describedby={cards.length < 2 ? 'comparison-requirement' : undefined}
          onClick={() => onComparisonChange(true)}>Сравнить варианты</button>
      </div>
      {cards.length < 2 && <p id="comparison-requirement">Для сравнения сохраните минимум два варианта.</p>}
      {!free && <p>Сохранены все три варианта. Чтобы добавить новый, удалите один из них.</p>}
      {!current.valid && <p>Для сохранения завершите расчёт в конфигураторе.</p>}
      <p role="status">{[store.warning, message].filter(Boolean).join(' ')}</p>
      {cards.map(({ variant, title, values, total }) => <article className="variant-card" key={variant.slot}>
        <h4>{title}</h4><p>{values[1]} · {values[2]}</p>
        {total === null ? <p className="variant-warning">Каталог изменился. Загрузите вариант и исправьте недоступные параметры.</p> : <strong>{rubles(total)}</strong>}
        <div className="variant-actions">
          <button aria-label={'Загрузить вариант ' + variant.slot} onClick={() => { setMessage(''); onLoad(variant) }}>Загрузить вариант</button>
          <button aria-label={'Удалить вариант ' + variant.slot} onClick={() => {
            if (persist(store.variants.filter(v => v.slot !== variant.slot), 'Вариант удалён.') && editing === variant.slot) onEdit(null)
          }}>Удалить</button>
        </div>
      </article>)}
    </section>
  )
}

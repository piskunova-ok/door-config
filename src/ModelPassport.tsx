import type { DoorModel } from './data/catalog.ts'
import type { SizeOption } from './data/catalogData.ts'
import { interiorMaterial, modelSpec } from './data/doorSpecs.ts'

function Rows({ title, rows }: { title: string; rows: [string, string | number][] }) {
  return <table className="passport-table"><caption>{title}</caption><tbody>
    {rows.map(([label, value]) => <tr key={label}><th scope="row">{label}</th><td>{value}</td></tr>)}
  </tbody></table>
}

export function ModelPassport({ model, sizes }: { model: DoorModel; sizes: SizeOption[] }) {
  const s = modelSpec(model.id)
  if (!s) return null
  return <details className="model-passport"><summary>Паспорт модели</summary>
    <h4>О модели</h4><p>{s.about}</p>
    <Rows title="Основные характеристики" rows={[
      ['Серия', 'DOOR CONFIG'], ['Тип', 'Входная металлическая дверь'], ['Назначение', 'В квартиру'],
      ['Количество створок', 1], ['Дизайн', s.design],
      ['Доступные размеры', sizes.filter(size => model.sizes.includes(size.id)).map(size => size.label).join(', ')],
      ['На границе улица–дом', 'Установка не предусмотрена'],
    ]} />
    <Rows title="Отделка" rows={[['Снаружи', model.finishes.map(f => f.name).join(', ')], ['Изнутри', interiorMaterial]]} />
    <Rows title="Конструкция" rows={[
      ['Полотно', 'Каркасное'], ['Толщина полотна', s.leaf + ' мм'], ['Толщина стали полотна', s.steel + ' мм'],
      ['Глубина короба', s.frame + ' мм'], ['Наполнение', 'Минеральная плита'], ['Контуры уплотнения', s.seals],
      ['Терморазрыв', 'Нет'], ['Петли на подшипниках', s.hinges],
    ]} />
    <Rows title="Безопасность и оснащение" rows={[
      ['Штатные замки', 2], ['Глазок', 'Есть'], ['Ночная задвижка', s.latch ? 'Есть' : 'Нет'], ['Противосъёмные ригели', s.bolts],
    ]} />
  </details>
}

const parts = ['Наружная панель', 'Стальной лист', 'Каркас', 'Минеральная плита', 'Внутренняя декоративная панель', 'Уплотнители', 'Короб', 'Замковая зона']
export function ConstructionDiagram() {
  const pins = [[43,77],[82,84],[120,92],[161,99],[203,110],[246,75],[288,104],[122,148]]
  return <details className="construction-diagram"><summary>Как устроена дверь</summary><figure>
    <svg viewBox="0 0 310 220" role="img" aria-label="Разнесённый вид слоёв дверного полотна и короба. Номера соответствуют списку деталей.">
      <g transform="translate(17 39) skewY(-12)" stroke="#68584a" strokeWidth="2">
        <rect width="43" height="149" fill="#b99a80"/><rect x="42" y="16" width="43" height="149" fill="#a09c96"/>
        <path fill="#796e61" fillRule="evenodd" d="M84 32h44v149H84z M90 39v62h32V39z M90 109v65h32v-65z"/>
        <rect x="126" y="48" width="43" height="149" fill="#dbc8a0"/>
        <path d="m128 65 38 19-38 21 38 19-38 21 38 20-38 18" fill="none" stroke="#ab9471"/>
        <rect x="168" y="64" width="43" height="149" fill="#dbcabb"/>
        <path d="M221 226V73h50v153" strokeWidth="7" fill="none"/>
        <path d="M227 226V80h38v146" stroke="#736c61" strokeWidth="3" fill="none"/>
        <rect x="98" y="125" width="15" height="27" fill="#514744"/>
      </g>
      {pins.map(([x,y],i) => <g key={i}><circle cx={x} cy={y} r="9" fill="#4b3326"/><text x={x} y={y+3.5} textAnchor="middle" fill="white" fontSize="10">{i+1}</text></g>)}
    </svg>
    <ol>{parts.map(part => <li key={part}>{part}</li>)}</ol>
    <figcaption>Условная схема конструкции. Демонстрационная модель</figcaption>
  </figure></details>
}

export function InteriorSample({ color }: { color?: { tone: string; name: string } }) {
  return <div className="interior-sample">{color && <i style={{ backgroundColor: color.tone }} />}
    <span>{color?.name ?? 'Цвет не выбран'}</span><small>Образец внутренней панели</small></div>
}

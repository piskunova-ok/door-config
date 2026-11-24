type Spec = {
  design: string
  about: string
  leaf: number
  steel: string
  frame: number
  seals: number
  hinges: number
  latch: boolean
  bolts: number
}

const specs = new Map<string, Spec>([
  ['axis', { design: 'Минимализм, чистые линии', about: 'Гладкое полотно Axis оставляет в центре внимания цвет наружной панели. Лаконичная геометрия подходит для спокойного интерьера прихожей.', leaf: 80, steel: '1,2', frame: 90, seals: 2, hinges: 2, latch: false, bolts: 2 }],
  ['forma', { design: 'Геометрический рисунок', about: 'У Forma рисунок наружной панели строится на пересечении линий. Геометрия задаёт ритм поверхности и по-разному читается в светлой и тёмной отделке.', leaf: 85, steel: '1,2', frame: 95, seals: 2, hinges: 2, latch: true, bolts: 2 }],
  ['linea', { design: 'Современная классика, горизонтальные линии', about: 'Горизонтальное членение полотна Linea подчёркивает его пропорции. Сдержанный рисунок связывает классическую композицию с современной отделкой.', leaf: 90, steel: '1,5', frame: 100, seals: 3, hinges: 3, latch: true, bolts: 2 }],
  ['monolith', { design: 'Монолитные поверхности, минеральные фактуры', about: 'Monolith воспринимается как единая плоскость. Характер двери задают крупная поверхность и минеральные фактуры наружных панелей.', leaf: 100, steel: '1,5', frame: 110, seals: 3, hinges: 3, latch: true, bolts: 3 }],
  ['atelier', { design: 'Древесные фактуры, декоративная геометрия', about: 'Atelier сочетает направленный рисунок древесины с декоративной геометрией панели. Внутренний цвет подбирается отдельно под отделку прихожей.', leaf: 100, steel: '1,5', frame: 110, seals: 3, hinges: 3, latch: true, bolts: 3 }],
])

export const modelSpec = (id: string) => specs.get(id)
export const interiorMaterial = 'МДФ-панель с ПВХ-покрытием'
const palette = [
  { id: 'bianco', name: 'Бьянко', tone: '#eee9df' },
  { id: 'latte', name: 'Латте', tone: '#bfa58b' },
  { id: 'sand-oak', name: 'Песочный дуб', tone: '#c5aa7d' },
  { id: 'warm-grey', name: 'Тёплый серый', tone: '#918982' },
  { id: 'graphite', name: 'Графит', tone: '#4b4948' },
  { id: 'dark-walnut', name: 'Тёмный орех', tone: '#654939' },
]
export function interiorOptions(modelId: string | null) {
  return modelId && specs.has(modelId) ? palette : []
}
export function interiorColor(modelId: string | null, id?: string) {
  return interiorOptions(modelId).find(color => color.id === id)
}
export function constructionSummary(spec: Spec) {
  return `Полотно ${spec.leaf} мм · сталь ${spec.steel} мм · короб ${spec.frame} мм · контуры уплотнения: ${spec.seals}`
}

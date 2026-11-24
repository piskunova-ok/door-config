import PDFDocument from 'pdfkit'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const font = join(dirname(fileURLToPath(import.meta.url)), 'Manrope.ttf')
const rubles = new Intl.NumberFormat('ru-RU')
const formatMoney = amount => rubles.format(amount) + ' ₽'

export function createEstimatePdf({ number, createdAt, snapshot }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 46, font, info: { Title: 'Смета ' + number, Author: 'DOOR CONFIG' } })
    const chunks = []
    doc.on('data', chunk => chunks.push(chunk))
    doc.on('error', reject)
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    const left = 46
    const right = doc.page.width - left
    const width = right - left
    const ink = '#4B3326'
    const rule = y => doc.moveTo(left, y).lineTo(right, y).strokeColor('#D9CABC').stroke()
    const ensureRoom = height => {
      if (doc.y + height > doc.page.height - 56) doc.addPage()
    }
    doc.fillColor(ink).fontSize(12).text('DOOR CONFIG')
    doc.moveDown(0.8).fontSize(26).text('Предварительная смета')
    const date = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'long', timeZone: 'Europe/Moscow' }).format(new Date(createdAt))
    doc.fontSize(11).text(number + '   /   ' + date).moveDown(1.5)
    doc.fontSize(15).text(snapshot.model)
    doc.fontSize(11).text('Отделка: ' + snapshot.finish).text('Размер: ' + snapshot.size)
    doc.text('Комплектующие: ' + (snapshot.accessories.join(', ') || 'без дополнительных опций')).moveDown()
    doc.fontSize(14).text('Детализация стоимости').moveDown(0.4)
    for (const line of snapshot.lines) {
      doc.fontSize(11)
      const labelWidth = width - 120
      const height = Math.max(doc.heightOfString(line.label, { width: labelWidth }), 16) + 14
      ensureRoom(height)
      const y = doc.y
      doc.text(line.label, left, y + 4, { width: labelWidth })
      doc.text(formatMoney(line.amount), right - 112, y + 4, { width: 112, align: 'right' })
      rule(y + height - 3)
      doc.x = left
      doc.y = y + height
    }
    ensureRoom(100)
    doc.moveDown(0.6).fontSize(18).text('Итого   ' + formatMoney(snapshot.total))
    doc.moveDown(0.6).fillColor('#62584F').fontSize(10).text('Предварительный расчёт составлен из выбранных параметров. Итоговая стоимость уточняется после замера.', { width })
    doc.end()
  })
}

const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const id = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 64
const amount = value => Number.isSafeInteger(value) && value >= 0

export function validSubmission(body, now) {
  if (!plain(body) || body.website !== '' || !Number.isSafeInteger(body.startedAt) ||
      now - body.startedAt < 3000 || now - body.startedAt > 86400000) return false
  const { contact, configuration: config, quote } = body
  if (!plain(contact) || contact.consent !== true || typeof contact.name !== 'string' ||
      contact.name.trim().length < 2 || contact.name.length > 100 || /[\r\n]/.test(contact.name) ||
      typeof contact.phone !== 'string' || !/^[+\d ()-]{7,25}$/.test(contact.phone) ||
      !/^\d{7,15}$/.test(contact.phone.replace(/\D/g, '')) ||
      typeof contact.comment !== 'string' || contact.comment.length > 2000 ||
      typeof contact.email !== 'string' || contact.email.length > 254 ||
      (contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email))) return false
  if (!plain(config) || ![config.modelId, config.finishId, config.sizeId].every(id) ||
      typeof config.delivery !== 'boolean' || typeof config.installation !== 'boolean' ||
      !Array.isArray(config.accessoryIds) || config.accessoryIds.length > 20 ||
      !config.accessoryIds.every(id) || new Set(config.accessoryIds).size !== config.accessoryIds.length) return false
  return plain(quote) && amount(quote.total) && Array.isArray(quote.lines) && quote.lines.length <= 25 &&
    quote.lines.every(line => plain(line) && id(line.key) && amount(line.amount))
}

export function matchesQuote(quote, estimate) {
  return quote.total === estimate.total && quote.lines.length === estimate.lines.length &&
    quote.lines.every((line, index) => line.key === estimate.lines[index].key && line.amount === estimate.lines[index].amount)
}

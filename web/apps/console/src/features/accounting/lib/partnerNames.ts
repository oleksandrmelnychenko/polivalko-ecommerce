// Name hygiene rules for the partner directory. Suggestions only: a person confirms every change.

export type PartnerName = { title: string; note: string | null }
export type PartnerRole = 'supplier' | 'client' | 'other'

const LATIN_TWINS: Record<string, string> = {
  a: 'а', c: 'с', e: 'е', i: 'і', o: 'о', p: 'р', x: 'х', y: 'у',
  A: 'А', B: 'В', C: 'С', E: 'Е', H: 'Н', I: 'І', K: 'К', M: 'М', O: 'О', P: 'Р', T: 'Т', X: 'Х',
}
const LEGAL_FORMS = ['ТОВ', 'ФОП', 'ПП']
const QUOTES = new Set(['"', '“', '”', '„', '«', '»'])
const BEFORE_OPEN = /[\s([«„"“”/]/
const AFTER_CLOSE = /[\s.,;:)\]!?»"“”/]/

const spaces = (text: string) => text.replace(/[\s  ]+/g, ' ').trim()

/** Latin letters typed inside a Cyrillic word, such as a Latin "a" in an otherwise Ukrainian name. */
function fixMixedScript(text: string) {
  return text.replace(/[\p{L}'`’ʼ]+/gu, (word) => {
    if (!/\p{Script=Cyrillic}/u.test(word) || !/[A-Za-z]/.test(word)) return word
    const latin = word.match(/[A-Za-z]/g) ?? []
    return latin.every((ch) => ch in LATIN_TWINS) ? word.replace(/[A-Za-z]/g, (ch) => LATIN_TWINS[ch]) : word
  }).replace(/(\p{L})[`’ʼ](\p{L})/gu, "$1'$2")
}

function legalForms(text: string) {
  return text
    .replace(/(^|[\s(/])товариство з о[бм]еженою відповідальністю(?=$|[\s"«„“])/giu, '$1ТОВ')
    .replace(/(^|[\s(/])(фо-п|фоп|тов|пп)(?=$|[\s.,)/"«„“])/giu, (_, lead: string, form: string) =>
      lead + (form.toLocaleLowerCase('uk') === 'фо-п' ? 'ФОП' : form.toLocaleUpperCase('uk')))
}

/** Pairs straight and mixed quotes and renders them as «…» with „…“ inside. Unpaired ones are dropped or closed. */
function quotes(text: string) {
  const chars = [...text]
  const tokens: string[] = []
  let depth = 0
  chars.forEach((ch, i) => {
    if (!QUOTES.has(ch)) return tokens.push(ch)
    const prev = chars[i - 1]
    const next = chars[i + 1]
    let open: boolean
    if (ch === '«' || ch === '„') open = true
    else if (ch === '»') open = false
    else if (depth > 0 && (next === undefined || AFTER_CLOSE.test(next))) open = false
    else open = prev === undefined || BEFORE_OPEN.test(prev) || depth === 0
    if (open) {
      depth++
      tokens.push(depth === 1 ? '«' : '„')
    } else if (depth > 0) {
      tokens.push(depth === 1 ? '»' : '“')
      depth--
    }
  })
  while (depth > 0) tokens.push(depth-- === 1 ? '»' : '“')
  return tokens.join('').replace(/([«„])\s+/g, '$1').replace(/\s+([»“])/g, '$1').replace(/«»|„“/g, '')
}

/** Splits on slashes that are outside quotes, e.g. "Brand/Owner/goods". */
function slashParts(text: string) {
  const parts = ['']
  let depth = 0
  for (const ch of text) {
    if (ch === '«' || ch === '„') depth++
    if (ch === '»' || ch === '“') depth = Math.max(0, depth - 1)
    if (ch === '/' && depth === 0) parts.push('')
    else parts[parts.length - 1] += ch
  }
  return parts.map(spaces).filter(Boolean)
}

export function suggestPartnerName(title: string, note: string | null = null): PartnerName {
  let name = quotes(legalForms(fixMixedScript(spaces(title))))
  const notes: string[] = []
  const bracket = name.match(/^(.*?\S)\s*\(([^()]*)\)?$/u)
  if (bracket && /\p{L}/u.test(bracket[1]) && bracket[2].trim()) {
    name = bracket[1]
    notes.push(spaces(bracket[2]))
  }
  const parts = slashParts(name)
  if (parts.length > 1 && parts.every((part) => /\p{L}/u.test(part))) {
    const [head, ...rest] = parts
    const forms = rest.filter((part) => LEGAL_FORMS.includes(part))
    name = [...forms, head].join(' ')
    notes.unshift(...rest.filter((part) => !LEGAL_FORMS.includes(part)))
  }
  name = spaces(name)
  const extra = notes.join(', ')
  const kept = note?.trim() || null
  return { title: name, note: kept && extra ? kept + '; ' + extra : kept || extra || null }
}

/** Key under which two cards most likely describe the same partner. */
export function duplicateKey(title: string) {
  return spaces(
    suggestPartnerName(title).title
      .toLocaleLowerCase('uk')
      .replace(/(^|\s)(тов|фоп|пп)(?=\s|$)/gu, ' ')
      .replace(/[^\p{L}\p{N}]+/gu, ' '),
  )
}

export function partnerRole(category: string | null | undefined): PartnerRole {
  if (category === 'Постачальники') return 'supplier'
  return category && /клієнт/iu.test(category) ? 'client' : 'other'
}

export const roleOptions: { value: PartnerRole; label: string }[] = [
  { value: 'supplier', label: 'Постачальники' },
  { value: 'client', label: 'Клієнти' },
  { value: 'other', label: 'Інші' },
]

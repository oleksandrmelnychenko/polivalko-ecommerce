import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInThisContext } from 'node:vm'
import ts from 'typescript'

function load(file, imports = {}) {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8')
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  const exports = {}
  runInThisContext(`(exports, require) => { ${js}\n }`)(exports, (name) => {
    assert.ok(Object.hasOwn(imports, name), `Unexpected fixture dependency ${name}`)
    return imports[name]
  })
  return exports
}

const { archivePrefill, archivePrefillTemplate } = load('./archivePrefill.ts', {
  './workForms': load('./workForms.ts'),
  './workFormFields': load('./workFormFields.ts'),
})

const detail = Object.freeze({
  id: '28adc3b2-42ca-41ed-9396-ef1a1e866209', sourceId: 'source-document-001',
  entityType: 'invoice', documentType: 'out', currency: '980',
  sourceDate: '2026-11-20T23:55:37-08:00', total: 100,
})

function original(item, raw) {
  return { schemaVersion: 1, source: 'dntrade', entityType: item.entityType,
    sourceId: item.sourceId, documentType: item.documentType, raw }
}

const store = Object.freeze({ external_id: 'source-warehouse', title: 'Склад прикладу' })
const product = Object.freeze({ code: 123, sku: 'A-001', title: 'Тестовий товар', unit: 1 })

test('allows only known archive-to-form mappings', () => {
  const cases = [
    ['invoice', 'out', 'sales', 'sale'], ['invoice', 'in', 'sales', 'purchase'],
    ['invoice', 'back_from_provider', 'sales', 'return'], ['customerReturn', null, 'sales', 'return'],
    ['receipt', null, 'sales', 'sale'], ['cashOrder', 'in', 'finance', 'cash'],
    ['bankPayment', 'out', 'finance', 'bank'], ['invoice', 'move', 'warehouse', 'movement'],
    ['invoice', 'inventarization', 'warehouse', 'inventory'], ['partner', null, 'directory', 'counterparty'],
    ['cashbox', null, 'directory', 'reference'],
    ['financialReport', 'Звірка початкових залишків DNTrade', 'finance', 'opening-balance'],
    ['financialReport', 'Взаєморозрахунки з контрагентами', 'finance', 'reconciliation'],
  ]
  for (const [entityType, documentType, section, type] of cases) {
    assert.deepEqual(archivePrefillTemplate({ ...detail, entityType, documentType }), { section, type })
  }
  for (const [entityType, documentType] of [['invoice', 'writeoff'], ['order', null], ['financialReport', 'Звіт по касі']]) {
    assert.equal(archivePrefill({ ...detail, entityType, documentType }), null)
  }
})

test('metadata preserves original document day and never uses source IDs as labels or numbers', () => {
  const result = archivePrefill(detail)
  assert.equal(result.sourceRecordId, detail.id)
  assert.equal(result.documentDate, '2026-11-20')
  assert.equal(result.data.currency, 'UAH')
  assert.equal(result.data.number, null)
  assert.equal(result.data.organization, null)
  assert.equal(result.data.amount, null)
  assert.deepEqual(result.data.lines, [])
  assert.equal(archivePrefill({ ...detail, sourceDate: '2026-02-30' }).documentDate, null)
})

test('copies explicit product lines in order without a price or quantity rounding guess', () => {
  const products = Object.freeze([
    Object.freeze({ product, store, quantity: '0.1250', price: '12.3400' }),
    Object.freeze({ product, store, quantity: '-2', price: '3.3330' }),
  ])
  const raw = Object.freeze({ number: '0004', currency_iso: 980, organization: { title: 'Підприємство прикладу' },
    partner: { title: 'Контрагент прикладу', phone_number: '000 00 00' }, products, paid: 0 })
  const result = archivePrefill(detail, original(detail, raw))
  assert.equal(result.title, 'Продаж №0004')
  assert.equal(result.data.warehouse, store.title)
  assert.equal(result.data.organization, raw.organization.title)
  assert.equal(result.data.counterparty, raw.partner.title)
  assert.equal(result.data.phone, null)
  assert.equal(result.data.direction, null)
  assert.equal(result.data.amount, null)
  assert.deepEqual(result.data.lines, [
    { sku: 'A-001', description: 'Тестовий товар', unit: null, quantity: '0.125', expectedQuantity: null, unitPrice: '12.34' },
    { sku: 'A-001', description: 'Тестовий товар', unit: null, quantity: '-2', expectedQuantity: null, unitPrice: null },
  ])
})

test('ignores a malformed original or an original belonging to a different record', () => {
  const source = original(detail, { number: 'secret-number', products: [{ product }] })
  const metadata = archivePrefill(detail)
  for (const invalid of [null, {}, source.raw, { ...source, sourceId: 'different' },
    { ...source, source: 'different' }, { ...source, entityType: 'receipt' },
    { ...source, schemaVersion: 2 }, { ...source, documentType: 'in' }]) {
    assert.deepEqual(archivePrefill(detail, invalid), metadata)
  }
})

test('keeps an explicit finance amount and leaves ambiguous payment direction or currency empty', () => {
  const bank = { ...detail, entityType: 'bankPayment', documentType: 'out' }
  const raw = { account: { title: 'Рахунок прикладу', number: 'do-not-copy' },
    number: 9, total_sum: '-7.250', currency_iso: 840, paid: 0 }
  const result = archivePrefill(bank, original(bank, raw))
  assert.equal(result.data.account, raw.account.title)
  assert.equal(result.data.direction, 'out')
  assert.equal(result.data.amount, '-7.25')
  assert.equal(result.data.currency, null)
  const cash = { ...detail, entityType: 'cashOrder', documentType: 'correct', total: null, currency: null }
  assert.equal(archivePrefill(cash, original(cash, { paid: 0 })).data.amount, null)
  assert.equal(archivePrefill(cash, original(cash, { paid: 0 })).data.direction, null)
})

test('uses only explicitly counted inventory quantities and avoids warehouse assignments from IDs', () => {
  const count = { ...detail, documentType: 'inventarization' }
  const item = { store, product, fact_quantity: '0.000', quantity: '10.000', res_quantity: '-10.000' }
  const result = archivePrefill(count, original(count, { products: [item] }))
  assert.equal(result.data.lines[0].quantity, '0.000')
  assert.equal(result.data.lines[0].expectedQuantity, null)
  const movement = { ...detail, documentType: 'move' }
  const other = { ...item, store: { ...store, external_id: 'another-warehouse' } }
  const transfer = archivePrefill(movement, original(movement, { store_recipient: 'destination-id', products: [item, other] }))
  assert.equal(transfer.data.warehouse, null)
  assert.equal(transfer.data.destinationWarehouse, null)
})

test('does not populate report cutoff dates, aggregate totals, or an incomplete over-limit item list', () => {
  const report = { ...detail, entityType: 'financialReport', documentType: 'Звірка початкових залишків DNTrade' }
  const start = archivePrefill(report, original(report, { cutoff: report.sourceDate, amount: '100.00' }))
  assert.equal(start.documentDate, null)
  assert.equal(start.data.amount, null)
  const snapshot = { ...detail, entityType: 'inventorySnapshot', documentType: 'Залишки на складі' }
  const stocks = archivePrefill(snapshot, original(snapshot, { products: [{ product, fact_quantity: '1' }] }))
  assert.equal(stocks.documentDate, null)
  assert.deepEqual(stocks.data.lines, [])
  const products = Array.from({ length: 101 }, () => ({ product, store, quantity: '1' }))
  assert.equal(archivePrefill(detail, original(detail, { products: products.slice(0, 100) })).data.lines.length, 100)
  assert.deepEqual(archivePrefill(detail, original(detail, { products })).data.lines, [])
})

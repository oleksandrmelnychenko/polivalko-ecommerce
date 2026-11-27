import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInThisContext } from 'node:vm'
import ts from 'typescript'

const source = readFileSync(new URL('./reportParams.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
const lib = {}
runInThisContext(`(exports) => { ${js}\n }`)(lib)

const next = (address, tab, changes) => lib.nextReportParams(new URLSearchParams(address), tab, changes).toString()

test('a year chosen in a yearly report does not follow into the other sections or come back from them', () => {
  assert.equal(next('tab=invoices&year=2025', 'invoices', { tab: 'overview', horizon: '' }), 'tab=overview')
  assert.equal(next('tab=markets&year=2025', 'markets', { tab: 'winter', horizon: '' }), 'tab=winter')
  assert.equal(next('tab=overview&year=2025', 'overview', { tab: 'markets', horizon: '' }), 'tab=markets')
})

test('the year passes between the reconciliation and the buyer map', () => {
  assert.equal(next('tab=invoices&year=2025', 'invoices', { tab: 'markets', horizon: '' }), 'tab=markets&year=2025')
  assert.equal(next('tab=markets&year=2025&region=UA32&source=documents', 'markets', { tab: 'invoices', horizon: '' }),
    'tab=invoices&year=2025')
})

test('choosing a year inside a yearly report keeps it', () => {
  assert.equal(next('tab=invoices', 'invoices', { tab: 'invoices', year: '2024' }), 'tab=invoices&year=2024')
})

test('a section left behind takes its own filters with it', () => {
  assert.equal(next('tab=markets&region=UA32&source=online&metric=count&carrier=np&partnerSearch=abc&partnerPage=2', 'markets', { tab: 'overview' }), 'tab=overview')
  assert.equal(next('tab=winter&season=2025&week=3&partner=p1', 'winter', { tab: 'offers' }), 'tab=offers')
  assert.equal(next('tab=demand&kind=category', 'demand', { tab: 'forecast' }), 'tab=forecast')
})

test('a filter change stays in the section and returns to the first page', () => {
  assert.equal(next('tab=assortment&page=3&store=s1', 'assortment', { category: 'c1' }), 'tab=assortment&store=s1&category=c1')
  assert.equal(next('tab=assortment&page=3', 'assortment', { page: '4' }), 'tab=assortment&page=4')
  assert.equal(next('tab=assortment&store=s1', 'assortment', { store: '' }), 'tab=assortment')
})

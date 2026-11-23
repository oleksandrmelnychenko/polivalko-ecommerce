import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInThisContext } from 'node:vm'
import ts from 'typescript'

const source = readFileSync(new URL('./seasonLabels.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
const labels = {}
runInThisContext(`(exports) => { ${js}\n }`)(labels)

test('each season the shop answers with has its own name and colour', () => {
  assert.deepEqual(['in_season', 'all_year', 'off_season'].map(labels.seasonLabel), ['У сезоні', 'Цілорічний', 'Не сезон'])
  assert.deepEqual(['in_season', 'all_year', 'off_season'].map(labels.seasonTone), ['success', 'neutral', 'warning'])
})

test('the reason says what decided the season', () => {
  assert.deepEqual(['rule', 'product', 'category', 'department', 'none'].map(labels.sourceLabel),
    ['правило', 'історія товару', 'історія категорії', 'історія відділу', 'немає даних'])
  // The category sells now, but the product has a rule for other months, so it is not called in season.
  assert.equal(labels.seasonReason('all_year', 'rule_capped'), 'Цілорічний · категорія в сезоні, правило — ні')
  assert.equal(labels.seasonReason('off_season', 'rule'), 'Не сезон · правило')
})

test('a value the console does not know is shown as it came', () => {
  assert.equal(labels.seasonLabel('pre_season'), 'pre_season')
  assert.equal(labels.seasonTone('pre_season'), 'neutral')
  assert.equal(labels.sourceLabel('constructor'), 'constructor')
})

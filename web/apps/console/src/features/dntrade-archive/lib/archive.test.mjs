import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInThisContext } from 'node:vm'
import ts from 'typescript'

const source = readFileSync(new URL('./archive.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
const archive = {}
runInThisContext(`(exports) => { ${js}\n }`)(archive)

test('the time of a record is shown as the shop clock read, without the UTC mark DNTrade puts on it', () => {
  assert.equal(archive.archiveSourceDate('2025-06-14T23:10:00+00:00', true), '14.06.2025 23:10:00')
  assert.equal(archive.archiveSourceDate('2025-06-14T23:10:00.000Z', true), '14.06.2025 23:10:00')
  assert.equal(archive.archiveSourceDate('2025-06-14T23:10:00+00:00'), '14.06.2025')
})

test('another offset and a date without time stay as written', () => {
  assert.equal(archive.archiveSourceDate('2021-01-01T23:50:00-05:00', true), '01.01.2021 23:50:00-05:00')
  assert.equal(archive.archiveSourceDate('2026-11-19', true), '19.11.2026')
  assert.equal(archive.archiveSourceDate(null), '—')
})

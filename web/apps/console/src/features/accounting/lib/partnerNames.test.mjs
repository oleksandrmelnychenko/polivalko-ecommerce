import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInThisContext } from 'node:vm'
import ts from 'typescript'

const source = readFileSync(new URL('./partnerNames.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const names = {}
runInThisContext(`(exports) => { ${js}\n }`)(names)
const { suggestPartnerName: suggest, duplicateKey, partnerRole } = names
const same = (title, expected, note = null) => assert.deepEqual(suggest(title), { title: expected, note })

test('trims and collapses spaces', () => {
  same('  Іван   Петренко ', 'Іван Петренко')
  same('Компанія Тест', 'Компанія Тест')
})

test('moves a trailing bracket into the note', () => {
  same(' Іван (Шашлики)', 'Іван', 'Шашлики')
  same('ФОП Тестенко Ірина (дерев\'яні ложки)', 'ФОП Тестенко Ірина', 'дерев\'яні ложки')
  same('ФОП Тестенко Ірина (Олена Петрівна', 'ФОП Тестенко Ірина', 'Олена Петрівна')
  same('(без назви)', '(без назви)')
})

test('moves slash parts into the note and keeps a bare legal form in the name', () => {
  same('BRAND/ФОП Тестенко І.О', 'BRAND', 'ФОП Тестенко І.О')
  same('ФОП Тест/DLF/насіння', 'ФОП Тест', 'DLF, насіння')
  same('Квітка/ТОВ', 'ТОВ Квітка')
  same('Зелень/фоп ', 'ФОП Зелень')
  same('Квітка/ФОПи', 'Квітка', 'ФОПи')
  same('ТОВ "Ріг/Копито"', 'ТОВ «Ріг/Копито»')
  same('Розмір 1/2', 'Розмір 1/2')
})

test('pairs quotes as «…» and „…“', () => {
  same('ТОВ "Тест"', 'ТОВ «Тест»')
  same('"Тест"', '«Тест»')
  same('"АБВ" "ГДЕ"', '«АБВ» «ГДЕ»')
  same('БО "БФ" Сад', 'БО «БФ» Сад')
  same('ТОВ " Водний світ"', 'ТОВ «Водний світ»')
  same('ТОВ "Агро + "', 'ТОВ «Агро +»')
  same('ТОВ "Компанія "Тест""', 'ТОВ «Компанія „Тест“»')
  same('Організація "Фонд "Сад"', 'Організація «Фонд „Сад“»')
  same('ОСББ «НОВЕ-1»', 'ОСББ «НОВЕ-1»')
  same('Тест ""', 'Тест')
})

test('unifies legal forms', () => {
  same('ФО-П Тестенко', 'ФОП Тестенко')
  same('фо-п Тестенко  Ірина', 'ФОП Тестенко Ірина')
  same('ТОВАРИСТВО З ОМЕЖЕНОЮ ВІДПОВІДАЛЬНІСТЮ "Дім "', 'ТОВ «Дім»')
  same('Фопіна Ірина', 'Фопіна Ірина')
})

test('replaces Latin twins inside Cyrillic words and backtick apostrophes', () => {
  same('Мap`ян Тестенко', "Мар'ян Тестенко")
  same('Fiskars', 'Fiskars')
})

test('keeps an existing note in front of the extracted one', () => {
  assert.deepEqual(suggest('Іван (Шашлики)', 'постійний'), { title: 'Іван', note: 'постійний; Шашлики' })
  assert.deepEqual(suggest('Іван', 'постійний'), { title: 'Іван', note: 'постійний' })
})

test('keeps clean names unchanged', () => {
  for (const title of ['ТОВ «Тест»', 'Іван Петренко', 'ФОП Тестенко І.О.', 'Роздрібний покупець']) same(title, title)
})

test('groups likely duplicates', () => {
  assert.equal(duplicateKey('ТОВ "ТЕСТ"'), duplicateKey('ТОВ Тест'))
  assert.equal(duplicateKey('СЕЛЛ-ТЕСТ'), duplicateKey('СЕЛЛ_ТЕСТ'))
  assert.equal(duplicateKey('АБВ'), duplicateKey('АБВ.'))
  assert.equal(duplicateKey('Квітка/ТОВ'), duplicateKey('ТОВ Квітка'))
  assert.notEqual(duplicateKey('Іван'), duplicateKey('Іван Петренко'))
})

test('maps categories to roles', () => {
  assert.equal(partnerRole('Постачальники'), 'supplier')
  assert.equal(partnerRole('Постійні клієнти'), 'client')
  assert.equal(partnerRole('VIP клієнти'), 'client')
  assert.equal(partnerRole('Клієнти'), 'client')
  assert.equal(partnerRole('Поливальники'), 'other')
  assert.equal(partnerRole(null), 'other')
})

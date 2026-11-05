import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

const features = ['auth', 'navigation', 'search', 'dashboard', 'orders', 'customers', 'requests', 'catalog', 'content', 'integration', 'audit', 'staff', 'returns', 'site', 'settings']

const edges = Object.fromEntries(features.map((feature) => [feature, feature === 'auth' ? [] : ['auth']]))
edges.navigation = ['auth']
edges.search = ['auth', 'navigation']
edges.site = ['auth', 'content', 'catalog']
edges.settings = ['auth', 'content', 'integration']

const apps = { regex: '^(shop|console)(/|$)', message: 'Застосунки не імпортують один одного: спільний код — лише в @polivalko/shared.' }
const serverOnly = { regex: '^@polivalko/shared/api/server$', message: 'Консоль працює лише в браузері: використовуйте @/shared/api/client.' }
const appLayer = { regex: '^@/app(/|$)', message: 'Фічі й shared не імпортують шар app.' }
const restrict = (...extra) => ['error', { patterns: [apps, serverOnly, ...extra] }]

const featureRules = features.flatMap((feature) => {
  const allowed = edges[feature]
  const otherFeature = {
    regex: allowed.length ? `^@/features/(?!(${allowed.join('|')})$)` : '^@/features(/|$)',
    message: `Фіча ${feature} імпортує лише публічний API (index.ts) фіч: ${allowed.join(', ') || 'жодної'}.`,
  }
  return [
    { files: [`src/features/${feature}/*.{ts,tsx}`], rules: { 'no-restricted-imports': restrict(appLayer, otherFeature, { regex: '^\\.\\./', message: 'Інша фіча — лише через @/features/<фіча>.' }) } },
    { files: [`src/features/${feature}/*/*.{ts,tsx}`], rules: { 'no-restricted-imports': restrict(appLayer, otherFeature, { regex: '^\\.\\./\\.\\./', message: 'Інша фіча — лише через @/features/<фіча>.' }) } },
  ]
})

export default defineConfig([
  globalIgnores(['dist', 'node_modules']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended, reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
    languageOptions: { globals: globals.browser },
  },
  { files: ['vite.config.ts'], languageOptions: { globals: globals.node } },
  { files: ['src/shared/ui/data-table/DataTable.tsx'], rules: { 'react-hooks/incompatible-library': 'off' } },
  { files: ['src/**/*.{ts,tsx}'], rules: { 'no-restricted-imports': restrict() } },
  {
    files: ['src/shared/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrict(
        appLayer,
        { regex: '^@/features(/|$)', message: 'shared не залежить від фіч.' },
        { regex: '^(\\.\\.?/)+(.*/)?(features|app)(/|$)', message: 'shared не залежить від фіч і app.' },
      ),
    },
  },
  ...featureRules,
  {
    files: ['src/app/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrict({
        regex: '^@/features/[^/]+/(?!pages/[^/]+$).+',
        message: 'app бере з фіч лише публічний API (index.ts) і сторінки pages/*.',
      }),
    },
  },
])

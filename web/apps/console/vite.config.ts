import { fileURLToPath, URL } from 'node:url'
import { defineConfig, type ProxyOptions } from 'vite'
import react from '@vitejs/plugin-react'

const apiTarget = process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:8080'
const apiHost = process.env.API_HOST_HEADER ?? (process.env.API_INTERNAL_URL ? undefined : 'console.localhost:8080')
const siteUrl = process.env.VITE_SITE_URL ?? process.env.SITE_URL ?? 'http://localhost:8080'

const apiProxy: ProxyOptions = {
  target: apiTarget,
  changeOrigin: !apiHost,
  secure: false,
  configure: (proxy) => {
    proxy.on('proxyReq', (proxyReq) => {
      if (apiHost) proxyReq.setHeader('host', apiHost)
      proxyReq.setHeader('X-Forwarded-Proto', 'http')
    })
  },
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  define: {
    'import.meta.env.VITE_SITE_URL': JSON.stringify(siteUrl),
  },
  server: {
    port: 3001,
    strictPort: true,
    proxy: {
      '/api': apiProxy,
    },
  },
  preview: {
    port: 3001,
    proxy: {
      '/api': apiProxy,
    },
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'vendor-react', test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/, priority: 50 },
            { name: 'vendor-mantine', test: /node_modules[\\/]@mantine[\\/]/, priority: 40 },
            { name: 'vendor-table', test: /node_modules[\\/]@tanstack[\\/]/, priority: 30 },
            { name: 'vendor-icons', test: /node_modules[\\/]@tabler[\\/]icons-react[\\/]/, priority: 20 },
            { name: 'vendor', test: /node_modules[\\/]/, priority: 10 },
          ],
        },
      },
    },
  },
})

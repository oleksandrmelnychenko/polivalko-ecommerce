import { createServer, request } from 'node:http'
import next from 'next'

const port = Number(process.env.PORT ?? 3001)
const apiTarget = new URL(process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:8080')
const apiHost = process.env.API_HOST_HEADER ?? (process.env.API_INTERNAL_URL ? apiTarget.host : 'console.localhost:8080')

function proxyApi(req, res) {
  const upstream = request(
    {
      hostname: apiTarget.hostname,
      port: apiTarget.port,
      path: req.url,
      method: req.method,
      headers: { ...req.headers, host: apiHost, 'x-forwarded-proto': 'http' },
    },
    (response) => {
      res.writeHead(response.statusCode ?? 502, response.headers)
      response.pipe(res)
    },
  )
  upstream.on('error', (error) => {
    if (!res.headersSent) res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' })
    res.end(`API недоступний (${apiTarget.origin}): ${error.message}`)
  })
  req.pipe(upstream)
}

const server = createServer((req, res) => {
  if (req.url?.startsWith('/api/')) return proxyApi(req, res)
  return handle(req, res)
})

const app = next({ dev: true, dir: import.meta.dirname, port, httpServer: server })
const handle = app.getRequestHandler()

await app.prepare()
server.listen(port, () => {
  console.log(`Консоль: http://localhost:${port} · /api → ${apiTarget.origin} (Host: ${apiHost})`)
})

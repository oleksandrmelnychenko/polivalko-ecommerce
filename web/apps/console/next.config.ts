import path from 'node:path'
import type { NextConfig } from 'next'
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants'

const workspaceRoot = path.join(__dirname, '../..')

export default function consoleConfig(phase: string): NextConfig {
  return {
    output: phase === PHASE_DEVELOPMENT_SERVER ? undefined : 'export',
    turbopack: { root: workspaceRoot },
    transpilePackages: ['@polivalko/shared'],
    env: { SITE_URL: process.env.SITE_URL ?? 'http://localhost:8080' },
    poweredByHeader: false,
  }
}

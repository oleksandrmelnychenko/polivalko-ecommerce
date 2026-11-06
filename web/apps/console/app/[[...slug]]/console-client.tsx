'use client'

import dynamic from 'next/dynamic'

const ConsoleRoot = dynamic(() => import('@/app/ConsoleRoot').then((m) => m.ConsoleRoot), { ssr: false })

export function ConsoleClient() {
  return <ConsoleRoot />
}

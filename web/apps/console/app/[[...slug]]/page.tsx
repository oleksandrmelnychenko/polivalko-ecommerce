import { ConsoleClient } from './console-client'

export function generateStaticParams() {
  return [{ slug: [''] }]
}

export default function ConsolePage() {
  return <ConsoleClient />
}

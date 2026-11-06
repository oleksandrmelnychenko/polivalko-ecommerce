import { ColorSchemeScript, mantineHtmlProps } from '@mantine/core'
import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import '@/index.css'

export const metadata: Metadata = {
  title: 'Консоль PoliValko',
  robots: { index: false, follow: false },
  icons: { icon: '/favicon.ico' },
  other: { google: 'notranslate' },
}

export const viewport: Viewport = {
  themeColor: '#ffffff',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="uk" translate="no" {...mantineHtmlProps}>
      <head>
        <ColorSchemeScript defaultColorScheme="light" />
      </head>
      <body>
        <div id="root">{children}</div>
      </body>
    </html>
  )
}

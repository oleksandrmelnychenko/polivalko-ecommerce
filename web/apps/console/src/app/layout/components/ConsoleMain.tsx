import { AppShell } from '@mantine/core'
import type { PropsWithChildren } from 'react'

export function ConsoleMain({ children }: PropsWithChildren) {
  return (
    <AppShell.Main id="main">
      <div className="console-content">
        <div className="console-frame">{children}</div>
      </div>
    </AppShell.Main>
  )
}

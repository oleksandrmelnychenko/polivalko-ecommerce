import type { ReactNode } from 'react'
import './list-page.css'

export function ListPage({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={['console-list-page', className].filter(Boolean).join(' ')}>{children}</div>
}

export function ListPageBody({ children }: { children: ReactNode }) {
  return <div className="console-list-body">{children}</div>
}

export function ListPageFooter({ children }: { children: ReactNode }) {
  return <div className="console-list-footer">{children}</div>
}

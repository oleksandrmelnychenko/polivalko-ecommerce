import type { ReactNode } from 'react'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { PageHeaderActions, PageHeaderTitle } from './page-header-actions/PageHeaderActions'

type PageHeaderProps = {
  title: string
  heading?: ReactNode
  actions?: ReactNode
}

export function PageHeader({ title, heading, actions }: PageHeaderProps) {
  useDocumentTitle(title)
  return (
    <>
      {heading ? (
        <PageHeaderTitle>
          <div className="console-page-heading">{heading}</div>
        </PageHeaderTitle>
      ) : null}
      {actions ? <PageHeaderActions>{actions}</PageHeaderActions> : null}
    </>
  )
}

import type { ReactNode } from 'react'

type Props = {
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
  id?: string
}

export function AnalyticsCard({ title, description, actions, children, id }: Props) {
  return (
    <section className="pa-card" id={id}>
      <header className="pa-card-header">
        <div>
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {actions ? <div className="pa-card-actions">{actions}</div> : null}
      </header>
      {children}
    </section>
  )
}

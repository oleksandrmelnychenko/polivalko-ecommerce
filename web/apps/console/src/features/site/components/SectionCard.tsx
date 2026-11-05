import { useId, type ReactNode } from 'react'

type SectionCardProps = {
  title: string
  description?: ReactNode
  actions?: ReactNode
  children: ReactNode
}

export function SectionCard({ title, description, actions, children }: SectionCardProps) {
  const id = useId()
  return (
    <section className="site-card" aria-labelledby={id}>
      <div className="site-card-head">
        <div className="site-card-heading">
          <h2 id={id} className="app-section-title site-card-title">
            {title}
          </h2>
          {description ? <p className="site-card-description">{description}</p> : null}
        </div>
        {actions ? <div className="site-card-actions">{actions}</div> : null}
      </div>
      {children}
    </section>
  )
}

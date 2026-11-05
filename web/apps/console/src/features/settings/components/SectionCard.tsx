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
    <section className="settings-card" aria-labelledby={id}>
      <div className="settings-card-head">
        <div className="settings-card-heading">
          <h2 id={id} className="app-section-title settings-card-title">
            {title}
          </h2>
          {description ? <p className="settings-card-description">{description}</p> : null}
        </div>
        {actions ? <div className="settings-card-actions">{actions}</div> : null}
      </div>
      {children}
    </section>
  )
}

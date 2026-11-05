import { useId, type ReactNode } from 'react'

type DashboardCardProps = {
  title: ReactNode
  aside?: ReactNode
  flush?: boolean
  className?: string
  children: ReactNode
}

export function DashboardCard({ title, aside, flush = false, className, children }: DashboardCardProps) {
  const titleId = useId()
  return (
    <section className={['dash-card', className].filter(Boolean).join(' ')} aria-labelledby={titleId}>
      <header className="dash-card-head">
        <h2 id={titleId} className="dash-card-title">
          {title}
        </h2>
        {aside ? <div className="dash-card-aside">{aside}</div> : null}
      </header>
      <div className={flush ? 'dash-card-body is-flush' : 'dash-card-body'}>{children}</div>
    </section>
  )
}

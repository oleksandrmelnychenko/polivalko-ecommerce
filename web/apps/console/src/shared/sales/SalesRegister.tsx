import type { Icon } from '@tabler/icons-react'
import { useId, type ReactNode } from 'react'
import { MetricLabel } from '@/shared/ui/MetricCard'

type Props = { title: string; icon: Icon; actions?: ReactNode; children: ReactNode }

export function SalesRegister({ title, icon, actions, children }: Props) {
  const titleId = useId()
  return (
    <section className="sales-register" aria-labelledby={titleId}>
      <header className="sales-register-head">
        <h2 id={titleId}><MetricLabel icon={icon}>{title}</MetricLabel></h2>
        {actions && <div className="sales-register-actions">{actions}</div>}
      </header>
      {children}
    </section>
  )
}

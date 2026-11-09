import { Alert, Button, Skeleton, Text } from '@mantine/core'
import { IconAlertTriangle } from '@tabler/icons-react'
import { useId, type ReactNode } from 'react'

type OrderCardProps = {
  title: ReactNode
  aside?: ReactNode
  className?: string
  children: ReactNode
}

export function OrderCard({ title, aside, className, children }: OrderCardProps) {
  const headingId = useId()
  return (
    <section className={['order-card', className].filter(Boolean).join(' ')} aria-labelledby={headingId}>
      <header className="order-card-head">
        <h2 id={headingId} className="order-card-title">
          {title}
        </h2>
        {aside ? <div className="order-card-aside">{aside}</div> : null}
      </header>
      {children}
    </section>
  )
}

export function OrderCardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={['order-card-body', className].filter(Boolean).join(' ')}>{children}</div>
}

export function OrderCardNote({ children }: { children: ReactNode }) {
  return (
    <Text className="order-card-note" size="sm" c="dimmed">
      {children}
    </Text>
  )
}

type LoadState = { status: 'loading' | 'ready' | 'error' | 'forbidden'; reload: () => void }

export function OrderLoadState({ state, empty, children }: { state: LoadState; empty?: string; children: ReactNode }) {
  if (state.status === 'loading') {
    return (
      <OrderCardBody>
        <Skeleton height={56} radius="md" aria-busy="true" />
      </OrderCardBody>
    )
  }
  if (state.status === 'error' || state.status === 'forbidden') {
    return (
      <OrderCardBody>
        <Alert color="red" variant="light" icon={<IconAlertTriangle size={16} />} title="Не вдалося завантажити дані" role="alert">
          Спробуйте ще раз. Якщо помилка повториться, повідомте розробника.{' '}
          <Button variant="subtle" color="red" size="compact-xs" onClick={state.reload}>
            Повторити
          </Button>
        </Alert>
      </OrderCardBody>
    )
  }
  if (empty) return <OrderCardNote>{empty}</OrderCardNote>
  return children
}

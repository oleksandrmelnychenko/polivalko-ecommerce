import type { ComponentProps } from 'react'
import { PageState } from '@/shared/ui/PageState'

type SkeletonProps = {
  shape?: 'metric' | 'chart' | 'rows' | 'report'
  label: string
  inset?: boolean
}

export function DashboardSkeleton({ shape = 'rows', label, inset }: SkeletonProps) {
  return <div className={`dash-placeholder ${inset ? '' : 'dash-card'}`} data-shape={shape}
    role="status" aria-label={label} aria-busy="true">
    <span className="dash-shimmer dash-placeholder-heading" aria-hidden="true" />
    {shape === 'chart'
      ? <div className="dash-placeholder-bars" aria-hidden="true">
          {[34, 52, 42, 68, 55, 44, 72, 59, 82, 64, 89, 76].map((height, index) =>
            <span key={index} className="dash-shimmer" style={{ height: height + '%' }} />)}
        </div>
      : <span className="dash-shimmer dash-placeholder-value" aria-hidden="true" />}
    <span className="dash-shimmer dash-placeholder-line" aria-hidden="true" />
    {shape !== 'metric' && <span className="dash-shimmer dash-placeholder-line" aria-hidden="true" />}
  </div>
}

export function DashboardState(props: ComponentProps<typeof PageState>) {
  return props.kind === 'loading'
    ? <DashboardSkeleton inset label="Завантаження звіту" />
    : <PageState {...props} />
}

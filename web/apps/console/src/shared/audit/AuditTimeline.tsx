import { shortWhen } from '@/shared/lib/when'
import type { AuditEntry } from './auditApi'
import { actionText, actionTone, entityText } from './auditLabels'
import './audit-timeline.css'

type AuditTimelineProps = {
  entries: readonly AuditEntry[]
  showActor?: boolean
  showObject?: boolean
  activeId?: string | null
  onSelect?: (entry: AuditEntry) => void
}

export function AuditTimeline({ entries, showActor = true, showObject = false, activeId, onSelect }: AuditTimelineProps) {
  return (
    <ol className="audit-timeline">
      {entries.map((entry) => {
        const meta = [showActor ? entry.actor : null, showObject ? [entityText(entry.entityType), entry.entityId].filter(Boolean).join(' ') : null, shortWhen(entry.at)]
          .filter(Boolean)
          .join(' · ')
        const body = (
          <>
            <span className="audit-timeline-dot" aria-hidden="true" />
            <span className="audit-timeline-text">
              <span className="audit-timeline-action">{actionText(entry.action)}</span>
              <span className="audit-timeline-meta">{meta}</span>
            </span>
          </>
        )
        return (
          <li key={entry.id} className={`audit-timeline-item is-${actionTone(entry.action)}${entry.id === activeId ? ' is-active' : ''}`}>
            {onSelect ? (
              <button type="button" className="audit-timeline-row" aria-current={entry.id === activeId || undefined} onClick={() => onSelect(entry)}>
                {body}
              </button>
            ) : (
              <span className="audit-timeline-row">{body}</span>
            )}
          </li>
        )
      })}
    </ol>
  )
}

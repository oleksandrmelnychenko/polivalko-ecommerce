import { IconChevronDown } from '@tabler/icons-react'
import { VisuallyHidden } from '@mantine/core'
import type { ReactNode } from 'react'

// Five-column glyphs keep the dot spacing uniform even when a long amount scales down.
const glyphs: Record<string, string[]> = {
  '0': ['01110','10001','10001','10001','10001','10001','01110'],
  '1': ['00100','01100','00100','00100','00100','00100','01110'],
  '2': ['01110','10001','00001','00010','00100','01000','11111'],
  '3': ['11110','00001','00001','01110','00001','00001','11110'],
  '4': ['00010','00110','01010','10010','11111','00010','00010'],
  '5': ['11111','10000','10000','11110','00001','00001','11110'],
  '6': ['01110','10000','10000','11110','10001','10001','01110'],
  '7': ['11111','00001','00010','00100','01000','01000','01000'],
  '8': ['01110','10001','10001','01110','10001','10001','01110'],
  '9': ['01110','10001','10001','01111','00001','00001','01110'],
  ',': ['00','00','00','00','00','01','10'],
  '-': ['000','000','000','111','000','000','000'],
  ' ': ['00'],
}

function DotNumber({ value }: { value: string }) {
  const currency = value.endsWith('₴')
  const digits = currency ? value.slice(0, -1).trimEnd() : value
  const characters = Array.from(digits.replace(/\s/g, ' '))
  if (characters.some(char => !glyphs[char])) return <strong>{value}</strong>
  let width = 0
  const marks: string[] = []
  for (const char of characters) {
    const rows = glyphs[char]
    rows.forEach((row, y) => Array.from(row).forEach((pixel, x) => {
      if (pixel === '1') marks.push(`M${width + x + .5} ${y + .5}h.01`)
    }))
    width += rows[0].length + 1
  }
  return <>
    <VisuallyHidden>{value}</VisuallyHidden>
    <svg viewBox={`0 0 ${width - 1} 7`} aria-hidden="true" focusable="false" className="report-dot-number">
      <path d={marks.join(' ')} stroke="currentColor" strokeWidth=".79" strokeLinecap="round" />
    </svg>
    {currency && <span className="report-currency" aria-hidden="true">₴</span>}
  </>
}

type OverviewProps = {
  value: string
  label: string
  period: string
  groups: [{ label: string; count: number }, { label: string; count: number }]
}

export function ProductReportOverview({ value, label, period, groups }: OverviewProps) {
  const total = groups[0].count + groups[1].count
  const share = total ? groups[0].count / total : 0
  return <div className="report-overview">
    <div className="report-lead"><div className="report-value"><DotNumber value={value} /></div>
      <span>{label}</span>
    </div>
    <div className="report-distribution">
      <div className="report-dot-track" data-empty={!total || undefined} aria-hidden="true">
        <i style={{ width: `${share * 100}%` }} />
      </div>
      <dl className="report-legend">{groups.map(group => <div key={group.label}>
        <dt>{group.label}</dt><dd>{group.count.toLocaleString('uk-UA')}</dd>
      </div>)}</dl>
    </div>
    <small className="report-period">{period}</small>
  </div>
}

export function ProductReportDetails({ label, children }: { label: string; children: ReactNode }) {
  return <details className="report-details">
    <summary>{label}<IconChevronDown size={16} aria-hidden="true" /></summary>
    {children}
  </details>
}

import { MetricTrack } from '../MetricCard'
import './snippet-length.css'

export function SnippetLength({ length, target }: { length: number; target: number }) {
  return (
    <span className="snippet-length" data-over={length > target || undefined}>
      <span>{length} / {target} символів</span>
      <MetricTrack value={length} max={target} />
    </span>
  )
}

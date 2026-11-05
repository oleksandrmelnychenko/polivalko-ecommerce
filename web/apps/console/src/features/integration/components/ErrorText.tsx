import type { ShowDetail } from './DetailModal'

type ErrorTextProps = {
  text: string | null
  title: string
  onExpand: ShowDetail
  empty?: string
}

export function ErrorText({ text, title, onExpand, empty = 'немає' }: ErrorTextProps) {
  if (!text) return <span className="integration-muted">{empty}</span>
  if (text.length <= 80) return <span className="integration-bad integration-wrap">{text}</span>
  return (
    <button
      type="button"
      className="integration-error-more"
      aria-haspopup="dialog"
      onClick={() => onExpand({ title, body: <pre className="integration-pre">{text}</pre> })}
    >
      {text.slice(0, 60).trimEnd()}…
    </button>
  )
}

export function Failures({ count }: { count: number }) {
  return count > 0 ? <span className="integration-bad">{count}</span> : <>0</>
}

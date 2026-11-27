import { CopyButton, Tooltip, UnstyledButton } from '@mantine/core'
import './copy-text.css'

/**
 * A value staff paste elsewhere (an order number into a chat, a carrier site or a spreadsheet): one click copies it.
 * It is a button, so inside a clickable table row it copies instead of opening the row.
 */
export function CopyText({ value, label = value, className }: { value: string; label?: string; className?: string }) {
  return (
    <CopyButton value={value} timeout={1500}>
      {({ copied, copy }) => (
        <Tooltip label={copied ? 'Скопійовано' : 'Скопіювати'} withArrow openDelay={300} color={copied ? 'teal' : undefined}>
          <UnstyledButton
            className={['copy-text', copied ? 'is-copied' : '', className ?? ''].filter(Boolean).join(' ')}
            aria-label={`Скопіювати ${label}`}
            onClick={(event) => {
              event.stopPropagation()
              copy()
            }}
          >
            {label}
          </UnstyledButton>
        </Tooltip>
      )}
    </CopyButton>
  )
}

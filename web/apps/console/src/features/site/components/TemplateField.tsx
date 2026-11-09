import { Textarea, TextInput } from '@mantine/core'
import { useRef } from 'react'
import { SEO_LIMITS, TOKEN_LABELS, type TemplateToken } from '../lib/seoTemplates'
import { LengthCounter } from './SnippetPreview'

type TemplateFieldProps = {
  label: string
  value: string
  example: string
  limit: number
  tokens: TemplateToken[]
  multiline?: boolean
  required?: boolean
  error?: string
  onChange: (value: string) => void
}

export function TemplateField({ label, value, example, limit, tokens, multiline = false, required = false, error, onChange }: TemplateFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const areaRef = useRef<HTMLTextAreaElement>(null)

  function insert(token: TemplateToken) {
    const input = multiline ? areaRef.current : inputRef.current
    const text = `{${token}}`
    const start = input?.selectionStart ?? value.length
    const end = input?.selectionEnd ?? value.length
    onChange(value.slice(0, start) + text + value.slice(end))
    const caret = start + text.length
    requestAnimationFrame(() => {
      input?.focus()
      input?.setSelectionRange(caret, caret)
    })
  }

  const description = (
    <>
      <LengthCounter length={example.length} limit={limit} /> · приклад: {example || 'порожньо'}
    </>
  )

  return (
    <div className="site-template-field">
      {multiline ? (
        <Textarea
          ref={areaRef}
          label={label}
          description={description}
          inputWrapperOrder={['label', 'input', 'description', 'error']}
          value={value}
          maxLength={SEO_LIMITS.maxLength}
          autosize
          minRows={2}
          required={required}
          spellCheck={false}
          error={error}
          onChange={(event) => onChange(event.currentTarget.value)}
        />
      ) : (
        <TextInput
          ref={inputRef}
          label={label}
          description={description}
          inputWrapperOrder={['label', 'input', 'description', 'error']}
          value={value}
          maxLength={SEO_LIMITS.maxLength}
          required={required}
          spellCheck={false}
          autoComplete="off"
          error={error}
          onChange={(event) => onChange(event.currentTarget.value)}
        />
      )}
      <div className="site-token-row" role="group" aria-label={`Вставити змінну в поле «${label}»`}>
        {tokens.map((token) => (
          <button key={token} type="button" className="site-token" onMouseDown={(event) => event.preventDefault()} onClick={() => insert(token)}>
            <span className="site-token-code">{`{${token}}`}</span>
            <span className="site-token-label">{TOKEN_LABELS[token]}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

import { TextInput } from '@mantine/core'
import type { ReactNode } from 'react'

type TwoFactorCodeInputProps = {
  value: string
  onChange: (value: string) => void
  label?: string
  description?: ReactNode
  error?: string
  errorSpace?: string
  disabled?: boolean
  recovery?: boolean
  autoFocus?: boolean
}

export function TwoFactorCodeInput({
  value,
  onChange,
  label = 'Код із застосунку',
  description,
  error,
  errorSpace,
  disabled,
  recovery = false,
  autoFocus,
}: TwoFactorCodeInputProps) {
  return (
    <TextInput
      className="two-factor-code"
      label={label}
      description={description}
      error={error}
      wrapperProps={{ 'data-error-space': errorSpace }}
      disabled={disabled}
      value={value}
      inputMode={recovery ? 'text' : 'numeric'}
      autoComplete="one-time-code"
      autoCapitalize={recovery ? 'characters' : 'none'}
      spellCheck={false}
      maxLength={recovery ? 11 : 7}
      placeholder={recovery ? 'XXXXX-XXXXX' : '000000'}
      onChange={(event) => onChange(recovery ? event.currentTarget.value.toUpperCase() : event.currentTarget.value.replace(/[^\d ]/g, ''))}
      data-autofocus={autoFocus || undefined}
      translate="no"
    />
  )
}

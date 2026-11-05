import { Kbd, Modal } from '@mantine/core'
import { IconSearch } from '@tabler/icons-react'
import { useEffect, useEffectEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNavigation } from '@/features/navigation'
import { onConsoleEvent } from '@/shared/lib/events'
import { searchConsole } from '../api/searchApi'
import { MIN_TERM_LENGTH, paletteGroups, type PaletteItem, type SearchResult } from '../lib/paletteItems'
import './search.css'

export function SearchPalette() {
  const navigate = useNavigate()
  const { sections } = useNavigation()
  const [opened, setOpened] = useState(false)
  const [q, setQ] = useState('')
  const [result, setResult] = useState<{ q: string; data: SearchResult | null } | null>(null)
  const [active, setActive] = useState(0)

  const open = useEffectEvent(() => {
    if (opened) return
    setQ('')
    setResult(null)
    setActive(0)
    setOpened(true)
  })

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target
      const typing = target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
      if (((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') || (event.key === '/' && !typing)) {
        event.preventDefault()
        open()
      }
    }
    window.addEventListener('keydown', onKey)
    const off = onConsoleEvent('open-search', () => open())
    return () => {
      window.removeEventListener('keydown', onKey)
      off()
    }
  }, [])

  const term = q.trim()

  useEffect(() => {
    if (!opened || term.length < MIN_TERM_LENGTH) return undefined
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      searchConsole(term, controller.signal)
        .then(({ data }) => {
          setResult({ q: term, data: data ?? null })
          setActive(0)
        })
        .catch(() => {
          if (!controller.signal.aborted) setResult({ q: term, data: null })
        })
    }, 180)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [opened, term])

  const current = result && result.q === term ? result.data : null
  const groups = paletteGroups(term, sections, current)
  const items = groups.flatMap((group) => group.items)
  const searching = term.length >= MIN_TERM_LENGTH && result?.q !== term
  const offsets = groups.map((_, index) => groups.slice(0, index).reduce((sum, group) => sum + group.items.length, 0))

  function go(item: PaletteItem | undefined) {
    if (!item) return
    setOpened(false)
    navigate(item.href)
  }

  return (
    <Modal
      opened={opened}
      onClose={() => setOpened(false)}
      withCloseButton={false}
      size={640}
      padding={0}
      radius={14}
      yOffset="10vh"
      classNames={{ content: 'palette', body: 'palette-body-root' }}
      aria-label="Пошук по консолі"
    >
      <div className="palette-bar">
        <IconSearch size={18} stroke={1.8} aria-hidden="true" />
        <input
          value={q}
          onChange={(event) => {
            setQ(event.target.value)
            setActive(0)
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault()
              if (items.length) setActive((index) => (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length)
            } else if (event.key === 'Enter') {
              event.preventDefault()
              go(items[active])
            }
          }}
          placeholder="Номер замовлення, телефон, товар або артикул…"
          aria-label="Що шукаємо"
          role="combobox"
          aria-expanded={items.length > 0}
          aria-controls="palette-list"
          aria-activedescendant={items[active] ? `palette-${items[active].key}` : undefined}
          autoComplete="off"
          spellCheck={false}
          data-autofocus
        />
        <Kbd size="xs">Esc</Kbd>
      </div>
      <div className="palette-list" id="palette-list" role="listbox" aria-label="Результати">
        {groups.map((group, groupIndex) => (
          <div key={group.title} className="palette-group" role="group" aria-label={group.title}>
            <p className="palette-group-title" aria-hidden="true">
              {group.title}
            </p>
            {group.items.map((item, itemIndex) => {
              const index = offsets[groupIndex] + itemIndex
              const ItemIcon = item.icon
              return (
                <div
                  key={item.key}
                  id={`palette-${item.key}`}
                  className="palette-item"
                  role="option"
                  aria-selected={index === active}
                  onPointerMove={() => setActive(index)}
                  onClick={() => go(item)}
                >
                  {item.image ? (
                    <img src={item.image} alt="" className="palette-thumb" loading="lazy" />
                  ) : (
                    <span className="palette-icon">
                      <ItemIcon size={16} stroke={1.7} />
                    </span>
                  )}
                  <span className="palette-main">
                    <strong>{item.title}</strong>
                    <span>{item.sub}</span>
                  </span>
                  {item.side ? <span className="palette-side">{item.side}</span> : null}
                </div>
              )
            })}
          </div>
        ))}
        {searching ? <p className="palette-empty">Шукаємо…</p> : null}
        {term.length >= MIN_TERM_LENGTH && !searching && items.length === 0 ? <p className="palette-empty">Нічого не знайдено за «{term}».</p> : null}
      </div>
      <div className="palette-foot" aria-hidden="true">
        <span>
          <Kbd size="xs">↑</Kbd> <Kbd size="xs">↓</Kbd> вибрати
        </span>
        <span>
          <Kbd size="xs">Enter</Kbd> відкрити
        </span>
        <span>
          <Kbd size="xs">Ctrl K</Kbd> або <Kbd size="xs">/</Kbd> з будь-якої сторінки
        </span>
      </div>
    </Modal>
  )
}

import { ActionIcon, Button, Loader, Menu } from '@mantine/core'
import { IconArrowDown, IconArrowLeft, IconArrowUp, IconArrowsSort, IconChevronRight, IconRefresh } from '@tabler/icons-react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import '@/shared/ui/split/split.css'
import './site-home.css'
import './site-records.css'

type RecordRow = {
  id: string
  name: string
  detail: ReactNode
  icon: ReactNode
  sortValues?: Record<string, string | number>
}

type Props = {
  title: string
  parameter: string
  rows: RecordRow[]
  empty: ReactNode
  loading: boolean
  refreshing: boolean
  refresh: () => void
  sortOptions?: { key: string; label: string; descending?: boolean }[]
  children: (id: string) => ReactNode
}

const compareText = new Intl.Collator('uk', { numeric: true, sensitivity: 'base' })

export function SiteRecordWorkspace({ title, parameter, rows, empty, loading, refreshing, refresh, sortOptions, children }: Props) {
  const [params, setParams] = useSearchParams()
  const prefix = useId()
  const [sort, setSort] = useState<{ key: string; descending: boolean } | null>(null)
  const ordered = sort ? [...rows].sort((a, b) => {
    const x = a.sortValues?.[sort.key] ?? ''
    const y = b.sortValues?.[sort.key] ?? ''
    const delta = typeof x === 'number' && typeof y === 'number' ? x - y : compareText.compare(String(x), String(y))
    return sort.descending ? -delta : delta
  }) : rows
  const picked = params.get(parameter)
  const selected = rows.find(row => row.id === picked) ?? ordered[0]
  const editing = Boolean(selected && selected.id === picked)
  const detail = useRef<HTMLDivElement>(null)
  const previous = useRef<string | null>(null)
  useEffect(() => {
    if (!window.matchMedia('(max-width: 52em)').matches) return
    if (editing) detail.current?.focus()
    else if (previous.current) document.getElementById(prefix + previous.current)?.focus()
    previous.current = editing ? picked : null
  }, [editing, picked, prefix])

  function select(id: string | null) {
    setParams(current => {
      const next = new URLSearchParams(current)
      if (id) next.set(parameter, id)
      else next.delete(parameter)
      return next
    }, { replace: true })
  }

  return (
    <div className="home-workspace site-records" data-editing={editing || undefined}>
      <section className="home-block-list" aria-label={title}>
        <header>
          <h2>{title} <span className="home-count">{loading ? '' : rows.length}</span></h2>
          <div className="site-record-actions">
            {sortOptions && <Menu position="bottom-end">
              <Menu.Target><ActionIcon variant="subtle" color="gray" aria-label="Сортувати список"><IconArrowsSort size={16} /></ActionIcon></Menu.Target>
              <Menu.Dropdown>{sortOptions.map(option =>
                <Menu.Item key={option.key} rightSection={sort?.key === option.key && (sort.descending ? <IconArrowDown size={14} /> : <IconArrowUp size={14} />)}
                  onClick={() => setSort({ key: option.key, descending: sort?.key === option.key ? !sort.descending : Boolean(option.descending) })}>
                  {option.label}
                </Menu.Item>
              )}</Menu.Dropdown>
            </Menu>}
            <ActionIcon variant="subtle" color="gray" loading={refreshing} onClick={refresh} aria-label="Оновити список"><IconRefresh size={16} /></ActionIcon>
          </div>
        </header>
        {loading ? <Loader size="sm" aria-label="Завантаження" /> : !rows.length ? <div className="site-record-empty">{empty}</div> :
          <ol>{ordered.map(row =>
            <li key={row.id}>
              <button type="button" id={prefix + row.id} className="home-block" aria-current={selected?.id === row.id || undefined} onClick={() => select(row.id)}>
                <span className="home-block-icon" aria-hidden="true">{row.icon}</span>
                <span className="home-block-name">{row.name}<span className="site-record-meta">{row.detail}</span></span>
                <IconChevronRight size={14} aria-hidden="true" />
              </button>
            </li>
          )}</ol>}
      </section>
      {selected && <div className="home-block-editor" ref={detail} tabIndex={-1}>
        <Button variant="subtle" color="gray" size="xs" className="home-back" leftSection={<IconArrowLeft size={15} />} onClick={() => select(null)}>До списку</Button>
        {children(selected.id)}
      </div>}
    </div>
  )
}

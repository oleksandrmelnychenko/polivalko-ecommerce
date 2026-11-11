import type { ReactNode } from 'react'
import './screen-tabs.css'

export type ScreenTab<V extends string> = {
  value: V
  label: ReactNode
  count?: number | null
  hot?: boolean
}

type ScreenTabsProps<V extends string> = {
  tabs: ScreenTab<V>[]
  value: V
  label: string
  onChange: (value: V) => void
}

const countFormat = new Intl.NumberFormat('uk-UA')

export function ScreenTabs<V extends string>({ tabs, value, label, onChange }: ScreenTabsProps<V>) {
  return (
    <div className="app-screen-tabs">
      <div className="app-screen-tabs-track" role="tablist" aria-label={label}>
        {tabs.map((tab) => {
          const active = tab.value === value
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={active}
              className={`app-screen-tab${active ? ' is-active' : ''}`}
              onClick={() => onChange(tab.value)}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined ? (
                <span className={`app-screen-tab-count${tab.hot && tab.count ? ' is-hot' : ''}`}>
                  {tab.count == null ? '·' : countFormat.format(tab.count)}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}

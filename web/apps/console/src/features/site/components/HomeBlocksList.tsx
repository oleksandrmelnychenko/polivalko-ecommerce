import { Switch } from '@mantine/core'
import type { ReactNode } from 'react'
import type { HomeBlock } from '../api/siteApi'
import { blockHint, blockName, moveItem } from '../lib/homeSettings'
import { MoveButtons } from './MoveButtons'

type HomeBlocksListProps = {
  blocks: HomeBlock[]
  notes?: Partial<Record<string, ReactNode>>
  onChange: (blocks: HomeBlock[]) => void
}

export function HomeBlocksList({ blocks, notes = {}, onChange }: HomeBlocksListProps) {
  return (
    <ol className="site-blocks" aria-label="Блоки головної за порядком">
      {blocks.map((block, index) => {
        const name = blockName(block.key)
        return (
          <li key={block.key} className={`site-block${block.visible ? '' : ' is-hidden'}`}>
            <span className="site-block-index" aria-hidden="true">
              {index + 1}
            </span>
            <div className="site-block-text">
              <span className="site-block-name">{name}</span>
              <span className="site-block-hint">{blockHint(block.key)}</span>
              {notes[block.key] ? <span className="site-block-note">{notes[block.key]}</span> : null}
            </div>
            <Switch
              className="site-block-switch"
              label={block.visible ? 'Показується' : 'Приховано'}
              aria-label={`Показувати блок «${name}»`}
              checked={block.visible}
              onChange={(event) => {
                const visible = event.currentTarget.checked
                onChange(blocks.map((item) => (item.key === block.key ? { ...item, visible } : item)))
              }}
            />
            <MoveButtons index={index} count={blocks.length} label={name} onMove={(delta) => onChange(moveItem(blocks, index, delta))} />
          </li>
        )
      })}
    </ol>
  )
}

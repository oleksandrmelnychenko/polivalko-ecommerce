import { ActionIcon, Tooltip } from '@mantine/core'
import {
  IconChevronRight,
  IconClipboardList,
  IconFileText,
  IconFolder,
  IconLayoutDashboard,
  IconLock,
  IconPlugConnected,
  IconSettings,
  IconShoppingBag,
  IconTag,
  IconUsers,
  type Icon,
} from '@tabler/icons-react'
import { useId } from 'react'
import type { PermissionDefinition } from '@/shared/auth/permissionsApi'
import { TableChip } from '@/shared/ui/TableChip'
import { RISK_LABELS, selectionState, type PermissionSection } from '../lib/permissionTree'
import { SelectionMark } from './SelectionMark'

const SECTION_ICONS: Record<string, Icon> = {
  dashboard: IconLayoutDashboard,
  orders: IconShoppingBag,
  customers: IconUsers,
  requests: IconClipboardList,
  catalog: IconTag,
  content: IconFileText,
  integration: IconPlugConnected,
  system: IconSettings,
}

const RISK_TONES = { low: 'neutral', medium: 'warning', high: 'danger' } as const

const LOCKED_HINT = 'Цього права немає у вашої ролі, тому надати його не можна.'

type PermissionTreeProps = {
  sections: PermissionSection[]
  selected: ReadonlySet<string>
  baseline: ReadonlySet<string>
  readOnly: boolean
  canToggle: (key: string) => boolean
  collapsed: ReadonlySet<string>
  forceExpanded: boolean
  onToggleCollapsed: (sectionId: string) => void
  onToggleKeys: (keys: readonly string[]) => void
}

export function PermissionTree({ sections, selected, baseline, readOnly, canToggle, collapsed, forceExpanded, onToggleCollapsed, onToggleKeys }: PermissionTreeProps) {
  return (
    <div className="roles-tree">
      {sections.map((section) => (
        <SectionBlock
          key={section.id}
          section={section}
          selected={selected}
          baseline={baseline}
          readOnly={readOnly}
          canToggle={canToggle}
          expanded={forceExpanded || !collapsed.has(section.id)}
          onToggleCollapsed={onToggleCollapsed}
          onToggleKeys={onToggleKeys}
        />
      ))}
    </div>
  )
}

type SectionBlockProps = Omit<PermissionTreeProps, 'sections' | 'collapsed' | 'forceExpanded'> & { section: PermissionSection; expanded: boolean }

function SectionBlock({ section, selected, baseline, readOnly, canToggle, expanded, onToggleCollapsed, onToggleKeys }: SectionBlockProps) {
  const titleId = useId()
  const keys = section.permissions.map((permission) => permission.key)
  const toggleable = keys.filter(canToggle)
  const state = selectionState(keys, selected)
  const changed = keys.filter((key) => selected.has(key) !== baseline.has(key)).length
  const SectionIcon = SECTION_ICONS[section.id] ?? IconFolder

  return (
    <section className="roles-section" aria-labelledby={titleId}>
      <div className="roles-section-head">
        <ActionIcon
          className="roles-disclosure"
          variant="subtle"
          color="gray"
          size="sm"
          aria-expanded={expanded}
          aria-label={`${expanded ? 'Згорнути' : 'Розгорнути'}: ${section.label}`}
          onClick={() => onToggleCollapsed(section.id)}
        >
          <IconChevronRight size={16} stroke={1.8} style={{ transform: expanded ? 'rotate(90deg)' : undefined }} />
        </ActionIcon>
        <SelectionMark
          checked={state.checked}
          indeterminate={state.indeterminate}
          disabled={readOnly || toggleable.length === 0}
          label={`Усі права розділу «${section.label}»`}
          onChange={() => onToggleKeys(toggleable)}
        />
        <span className="roles-section-icon" aria-hidden="true">
          <SectionIcon size={18} stroke={1.7} />
        </span>
        <button type="button" className="roles-section-title" onClick={() => onToggleCollapsed(section.id)}>
          <span id={titleId}>{section.label}</span>
        </button>
        <span className="roles-section-stats">
          {changed > 0 ? <TableChip tone="warning" value={`змін: ${changed}`} /> : null}
          <TableChip tone={state.count > 0 ? 'success' : 'neutral'} value={`${state.count}/${keys.length}`} title={`Вибрано ${state.count} з ${keys.length}`} />
        </span>
      </div>
      {expanded ? (
        <div className="roles-section-body">
          {section.permissions.map((permission) => (
            <PermissionRow
              key={permission.key}
              permission={permission}
              checked={selected.has(permission.key)}
              wasChecked={baseline.has(permission.key)}
              disabled={readOnly || !canToggle(permission.key)}
              locked={!readOnly && !canToggle(permission.key)}
              onToggle={() => onToggleKeys([permission.key])}
            />
          ))}
        </div>
      ) : null}
    </section>
  )
}

type PermissionRowProps = {
  permission: PermissionDefinition
  checked: boolean
  wasChecked: boolean
  disabled: boolean
  locked: boolean
  onToggle: () => void
}

function PermissionRow({ permission, checked, wasChecked, disabled, locked, onToggle }: PermissionRowProps) {
  const nameId = useId()
  const descriptionId = useId()
  const changed = checked !== wasChecked

  return (
    <div
      className={`roles-perm${checked ? ' is-checked' : ''}${changed ? ' is-changed' : ''}${disabled ? ' is-disabled' : ''}`}
      onClick={disabled ? undefined : onToggle}
    >
      <SelectionMark checked={checked} disabled={disabled} labelledBy={nameId} describedBy={descriptionId} size="sm" onChange={onToggle} />
      <div className="roles-perm-copy">
        <span className="roles-perm-title">
          <span id={nameId} className="roles-perm-name">
            {permission.name}
          </span>
          {changed ? <TableChip tone={checked ? 'success' : 'danger'} value={checked ? 'додано' : 'знято'} /> : null}
        </span>
        <span id={descriptionId} className="roles-perm-meta">
          {permission.description ? <span className="roles-perm-description">{permission.description}</span> : null}
          <code className="roles-perm-key">{permission.key}</code>
        </span>
      </div>
      <span className="roles-perm-side">
        {locked ? (
          <Tooltip label={LOCKED_HINT} multiline w={240}>
            <span className="roles-perm-lock" aria-label={LOCKED_HINT} role="img">
              <IconLock size={15} stroke={1.8} />
            </span>
          </Tooltip>
        ) : null}
        <TableChip tone={RISK_TONES[permission.risk]} value={RISK_LABELS[permission.risk]} />
      </span>
    </div>
  )
}

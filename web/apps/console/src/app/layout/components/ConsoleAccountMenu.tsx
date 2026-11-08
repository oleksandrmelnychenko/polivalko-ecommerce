import { Menu, Text } from '@mantine/core'
import { IconChevronDown, IconKey, IconLogout, IconShieldLock, IconUserCircle } from '@tabler/icons-react'
import { useState } from 'react'
import { ChangePasswordModal, TwoFactorModal, useAuth } from '@/features/auth'
import { TableChip } from '@/shared/ui/TableChip'

export function ConsoleAccountMenu() {
  const { me, logout } = useAuth()
  const [passwordOpened, setPasswordOpened] = useState(false)
  const [twoFactorOpened, setTwoFactorOpened] = useState(false)
  const displayName = me?.displayName?.trim() || me?.email || 'Обліковий запис'

  return (
    <>
      <Menu position="bottom-end" offset={6} width={280} withinPortal shadow="md" radius="md">
        <Menu.Target>
          <button type="button" className="console-account-trigger" aria-label={`Обліковий запис: ${displayName}`}>
            <IconUserCircle className="console-account-icon" size={22} stroke={1.6} aria-hidden="true" />
            <span className="console-account-name-short">{displayName}</span>
            <IconChevronDown className="console-account-chevron" size={14} aria-hidden="true" />
          </button>
        </Menu.Target>
        <Menu.Dropdown className="console-account-menu">
          <div className="console-account-details">
            <Text component="span" className="console-account-name">
              {displayName}
            </Text>
            {me?.email ? <span className="console-account-email">{me.email}</span> : null}
            {me?.roleName ? (
              <div className="console-account-role-row">
                <span>Роль</span>
                <TableChip tone="success" value={me.roleName} />
              </div>
            ) : null}
          </div>
          <Menu.Divider />
          <Menu.Item leftSection={<IconKey size={16} />} onClick={() => setPasswordOpened(true)}>
            Змінити пароль
          </Menu.Item>
          <Menu.Item leftSection={<IconShieldLock size={16} />} onClick={() => setTwoFactorOpened(true)}>
            Двофакторна перевірка
          </Menu.Item>
          <Menu.Item leftSection={<IconLogout size={16} />} onClick={() => void logout()}>
            Вийти
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
      <ChangePasswordModal opened={passwordOpened} onClose={() => setPasswordOpened(false)} />
      <TwoFactorModal opened={twoFactorOpened} onClose={() => setTwoFactorOpened(false)} />
    </>
  )
}

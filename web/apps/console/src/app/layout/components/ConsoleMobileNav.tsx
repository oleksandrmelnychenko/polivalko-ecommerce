import { Drawer } from '@mantine/core'
import { Link } from 'react-router-dom'
import { useNavigation } from '@/features/navigation'
import { NavBadge } from './NavBadge'

export function ConsoleMobileNav({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const { sections, activeItem, badgeOf } = useNavigation()

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="left"
      size={300}
      title={
        <span className="console-brand-inline" translate="no">
          PoliValko <span className="console-brand-tag">консоль</span>
        </span>
      }
      closeButtonProps={{ 'aria-label': 'Закрити меню' }}
      classNames={{ content: 'console-mobile-nav', body: 'console-mobile-nav-body' }}
    >
      <nav aria-label="Розділи консолі">
        {sections.map((section) => (
          <div key={section.id} className="console-mobile-section">
            <p className="console-mobile-section-title">{section.label}</p>
            {section.items.map((item) => {
              const ItemIcon = item.icon
              const current = item.id === activeItem?.id
              return (
                <Link
                  key={item.id}
                  to={item.path}
                  className={`console-mobile-link${current ? ' is-active' : ''}`}
                  aria-current={current ? 'page' : undefined}
                  onClick={onClose}
                >
                  <ItemIcon size={18} stroke={1.7} aria-hidden="true" />
                  <span>{item.label}</span>
                  <NavBadge count={badgeOf(item)} tone={item.badgeTone} label={item.label} />
                </Link>
              )
            })}
          </div>
        ))}
      </nav>
    </Drawer>
  )
}

import { Button } from '@mantine/core'
import { Link } from 'react-router-dom'
import { ARCHIVE_VIEWS, archiveShortcuts, archiveViewLocation, readArchiveView } from '../lib/archiveViews'
import './archive-navigation.css'

export function ArchiveNavigation({ params }: { params: URLSearchParams }) {
  const view = readArchiveView(params)
  const shortcuts = archiveShortcuts(view, params)

  return (
    <div className="dntrade-archive-navigation">
      <nav className="dntrade-archive-views" aria-label="Розділи архіву">
        {ARCHIVE_VIEWS.map((option) => (
          <Link
            key={option.id}
            className="dntrade-archive-view"
            to={archiveViewLocation(option, view, params)}
            aria-current={option.id === view.id ? 'page' : undefined}
          >
            {option.label}
          </Link>
        ))}
      </nav>
      {shortcuts.length ? (
        <nav className="dntrade-archive-shortcuts" aria-label="Швидкий доступ в архіві">
          <span className="dntrade-archive-shortcuts-label" aria-hidden="true">Швидкий доступ</span>
          {shortcuts.map(({ label, location, active }) => (
            <Button
              key={label}
              component={Link}
              to={location}
              variant={active ? 'light' : 'default'}
              size="xs"
              aria-current={active ? 'true' : undefined}
            >
              {label}
            </Button>
          ))}
        </nav>
      ) : null}
    </div>
  )
}

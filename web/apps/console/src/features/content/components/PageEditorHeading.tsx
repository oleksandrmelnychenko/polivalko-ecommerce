import { IconChevronRight } from '@tabler/icons-react'
import { Link } from 'react-router-dom'
import { CONTENT_PAGES_PATH } from '../lib/contentLinks'

export function PageEditorHeading({ title }: { title: string }) {
  return (
    <nav className="content-crumbs" aria-label="Хлібні крихти">
      <Link to={CONTENT_PAGES_PATH}>Сторінки</Link>
      <IconChevronRight size={14} stroke={1.8} aria-hidden="true" />
      <span aria-current="page">{title}</span>
    </nav>
  )
}

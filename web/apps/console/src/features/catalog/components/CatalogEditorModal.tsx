import type { Icon } from '@tabler/icons-react'
import { AppEditorModal, type AppEditorModalProps } from '@/shared/ui/AppEditorModal'
import './catalog-editor.css'

export function CatalogEditorModal({ icon: Icon, title, ...props }: AppEditorModalProps & { icon: Icon }) {
  return (
    <AppEditorModal
      {...props}
      className="catalog-editor-modal"
      title={<span className="catalog-editor-title"><Icon size={18} stroke={1.7} aria-hidden="true" /><span>{title}</span></span>}
    />
  )
}

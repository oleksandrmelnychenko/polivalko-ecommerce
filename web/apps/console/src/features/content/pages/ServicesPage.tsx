import { IconEye, IconPhoto, IconTools } from '@tabler/icons-react'
import { useMemo, useState } from 'react'
import { SiteMetrics } from '@/shared/ui/site/SiteMetrics'
import { SiteRecordWorkspace } from '@/shared/ui/site/SiteRecordWorkspace'
import { TableChip } from '@/shared/ui/TableChip'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { PageHeader } from '@/shared/ui/PageHeader'
import { getServices, type ServiceDirection } from '../api/contentApi'
import { ListError } from '../components/ListError'
import { ServiceDetailPane } from '../components/ServiceDetailPane'
import { ServiceDirectionDrawer } from '../components/ServiceDirectionDrawer'
import './content.css'

export function ServicesPage() {
  const services = useApiQuery('content-services', () => getServices())
  const [editing, setEditing] = useState<ServiceDirection | null>(null)
  const [opened, setOpened] = useState(false)
  const failed = services.status === 'error' || services.status === 'forbidden'
  const rows = useMemo(() => failed ? [] : [...(services.data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder), [failed, services.data])
  const visible = rows.filter(row => row.isVisible)

  return (
    <>
      <PageHeader title="Послуги" />
      {services.status === 'ready' && <SiteMetrics label="Наповнення послуг" metrics={[
        { label: 'Напрями послуг', icon: IconTools, count: rows.length },
        { label: 'Видимі на сайті', icon: IconEye, count: visible.length, total: rows.length },
        { label: 'З фотографією', icon: IconPhoto, count: rows.filter(row => row.imageUrl).length, total: rows.length },
      ]} />}
      <SiteRecordWorkspace
        title="Напрями послуг" parameter="code" refresh={services.reload} refreshing={services.isFetching} loading={services.isLoading}
        empty={failed ? <ListError problem={services.problem} onRetry={services.reload} /> : 'Послуг ще немає.'}
        rows={rows.map(row => ({
          id: row.code, name: row.name,
          icon: row.imageUrl ? <img src={row.imageUrl} alt="" loading="lazy" /> : <IconTools size={16} />,
          detail: <TableChip tone={row.isVisible ? 'success' : 'neutral'} value={row.isVisible ? 'Показується' : 'Приховано'} />,
          sortValues: { name: row.name, order: row.sortOrder, visible: Number(row.isVisible) },
        }))}
        sortOptions={[{ key: 'order', label: 'Порядок на сайті' }, { key: 'name', label: 'Назва' }, { key: 'visible', label: 'Видимість', descending: true }]}
      >
        {code => <ServiceDetailPane
          direction={rows.find(row => row.code === code) ?? null}
          position={visible.findIndex(row => row.code === code) + 1} visibleCount={visible.length}
          onEdit={direction => { setEditing(direction); setOpened(true) }}
        />}
      </SiteRecordWorkspace>
      <ServiceDirectionDrawer direction={editing} opened={opened} onClose={() => setOpened(false)}
        onSaved={direction => {
          services.setData(rows.map(row => row.code === direction.code ? direction : row))
          setOpened(false)
        }}
      />
    </>
  )
}

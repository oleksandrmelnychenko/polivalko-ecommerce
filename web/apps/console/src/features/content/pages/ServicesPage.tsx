import { IconTools } from '@tabler/icons-react'
import { useMemo, useState } from 'react'
import { SiteRecordWorkspace } from '@/shared/ui/site/SiteRecordWorkspace'
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
      <SiteRecordWorkspace
        title="Напрями послуг" parameter="code" refresh={services.reload} refreshing={services.isFetching} loading={services.isLoading}
        empty={failed ? <ListError problem={services.problem} onRetry={services.reload} /> : 'Послуг ще немає.'}
        rows={rows.map(row => ({
          id: row.code, name: row.name,
          icon: row.imageUrl ? <img src={row.imageUrl} alt="" loading="lazy" /> : <IconTools size={16} />,
          detail: <small data-state={row.isVisible ? 'live' : 'off'}>{row.isVisible ? 'Показується' : 'Приховано'}</small>,
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

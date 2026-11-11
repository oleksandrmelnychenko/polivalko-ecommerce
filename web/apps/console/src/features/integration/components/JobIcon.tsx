import { IconCreditCard, IconCurrencyHryvnia, IconFileImport, IconPackages, IconRefresh, IconTruckDelivery } from '@tabler/icons-react'

const icons: Record<string, typeof IconRefresh> = {
  'navkolo.price-stock': IconCurrencyHryvnia,
  'navkolo.catalog': IconPackages,
  'navkolo.import': IconFileImport,
  'novaposhta.directory': IconTruckDelivery,
  'payments.reconcile': IconCreditCard,
}

export function JobIcon({ job, size }: { job: string; size: number }) {
  const Icon = icons[job] ?? IconRefresh
  return <Icon size={size} stroke={1.6} />
}

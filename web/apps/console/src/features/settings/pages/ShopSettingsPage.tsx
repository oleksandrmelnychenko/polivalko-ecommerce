import { problemMessage } from '@/shared/api/problem'
import { useApiQuery } from '@/shared/api/useApiQuery'
import { PageHeader } from '@/shared/ui/PageHeader'
import { PageState } from '@/shared/ui/PageState'
import { getContacts, getShopSettings } from '../api/settingsApi'
import { ShopSettingsForm } from '../components/ShopSettingsForm'
import './settings.css'

export function ShopSettingsPage() {
  const contacts = useApiQuery('settings-contacts', () => getContacts())
  const shop = useApiQuery('settings-shop', () => getShopSettings())

  if (contacts.status === 'ready' && contacts.data && shop.status === 'ready' && shop.data) {
    return (
      <ShopSettingsForm
        contacts={contacts.data}
        shop={shop.data}
        onSaved={(nextContacts, nextShop) => {
          if (nextContacts) contacts.setData(nextContacts)
          if (nextShop) shop.setData(nextShop)
        }}
      />
    )
  }

  const failed = [contacts, shop].find((query) => query.status === 'error' || query.status === 'forbidden')

  return (
    <>
      <PageHeader title="Магазин" />
      {failed ? (
        <PageState
          kind={failed.status === 'forbidden' ? 'forbidden' : 'error'}
          description={problemMessage(failed.problem, 'Спробуйте ще раз. Якщо помилка повториться, повідомте розробника.')}
          onRetry={
            failed.status === 'error'
              ? () => {
                  contacts.reload()
                  shop.reload()
                }
              : undefined
          }
        />
      ) : (
        <PageState kind="loading" />
      )}
    </>
  )
}

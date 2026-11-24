import { MantineProvider } from '@mantine/core'
import { DatesProvider } from '@mantine/dates'
import { Notifications } from '@mantine/notifications'
import 'dayjs/locale/uk'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { AuthProvider } from '@/features/auth'
import { theme } from '@/shared/theme/theme'
import { HistoryLeaveGuard } from '@/shared/ui/LeaveGuard'
import { App } from '../App'
import './notifications.css'

const router = createBrowserRouter([{
  path: '*',
  element: <AuthProvider><HistoryLeaveGuard /><App /></AuthProvider>,
}])

export function AppProviders() {
  return (
    <MantineProvider theme={theme} defaultColorScheme="light">
      <DatesProvider settings={{ firstDayOfWeek: 1, locale: 'uk', weekendDays: [0, 6] }}>
        <Notifications position="bottom-right" containerWidth={380} className="app-toasts" />
        <RouterProvider router={router} />
      </DatesProvider>
    </MantineProvider>
  )
}

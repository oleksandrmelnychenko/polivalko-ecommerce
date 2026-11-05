import { notifications } from '@mantine/notifications'
import { IconAlertTriangle, IconCheck, IconInfoCircle } from '@tabler/icons-react'
import { problemMessage } from '../api/problem'

export function notifySuccess(message: string, title?: string): void {
  notifications.show({ color: 'brand', icon: <IconCheck size={16} />, title, message })
}

export function notifyError(message: string, title?: string): void {
  notifications.show({ color: 'red', icon: <IconAlertTriangle size={16} />, title, message, autoClose: 8000 })
}

export function notifyInfo(message: string, title?: string): void {
  notifications.show({ color: 'gray', icon: <IconInfoCircle size={16} />, title, message })
}

export function notifyProblem(error: unknown, fallback: string, title?: string): void {
  notifyError(problemMessage(error, fallback), title)
}

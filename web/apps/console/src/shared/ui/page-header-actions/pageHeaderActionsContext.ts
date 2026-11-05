import { createContext } from 'react'

export type PageHeaderActionsContextValue = {
  actionsContainer: HTMLElement | null
  titleContainer: HTMLElement | null
  setActionsContainer: (element: HTMLElement | null) => void
  setTitleContainer: (element: HTMLElement | null) => void
}

export const PageHeaderActionsContext = createContext<PageHeaderActionsContextValue>({
  actionsContainer: null,
  titleContainer: null,
  setActionsContainer: () => {},
  setTitleContainer: () => {},
})

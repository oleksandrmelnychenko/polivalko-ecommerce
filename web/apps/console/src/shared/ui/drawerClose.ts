import { createContext } from 'react'

export const DrawerCloseContext = createContext<(() => void) | null>(null)

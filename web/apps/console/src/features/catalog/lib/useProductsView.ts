import { useCallback, useState } from 'react'

export type ProductsView = 'table' | 'tiles'

const STORAGE_KEY = 'polivalko.console.products.view'

function readView(): ProductsView {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'tiles' ? 'tiles' : 'table'
  } catch {
    return 'table'
  }
}

function storeView(view: ProductsView): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, view)
    return true
  } catch {
    return false
  }
}

export function useProductsView() {
  const [view, setView] = useState<ProductsView>(readView)
  const change = useCallback((next: ProductsView) => {
    setView(next)
    storeView(next)
  }, [])
  return [view, change] as const
}

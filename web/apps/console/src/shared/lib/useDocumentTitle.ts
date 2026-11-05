import { useEffect, useLayoutEffect } from 'react'

const SUFFIX = 'Консоль PoliValko'

function apply(title: string | null | undefined): void {
  document.title = title ? `${title} · ${SUFFIX}` : SUFFIX
}

export function useDocumentTitle(title: string | null | undefined): void {
  useEffect(() => apply(title), [title])
}

export function useDefaultDocumentTitle(title: string | null | undefined): void {
  useLayoutEffect(() => apply(title), [title])
}

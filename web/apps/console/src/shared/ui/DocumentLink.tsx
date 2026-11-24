import { createContext } from 'react'
import { Link, matchPath, useLocation, type LinkProps, type Location } from 'react-router-dom'

export const DocumentOverlayContext = createContext(false)

// Document and partner cards open as overlays above the register they were opened from.
export const DOCUMENTS_PATH = '/finance/documents'
export const PARTNERS_PATH = '/finance/partners'

function registerBackground(location: Location) {
  for (const path of [DOCUMENTS_PATH, PARTNERS_PATH]) {
    if (matchPath(path + '/:id', location.pathname)) return location.state?.documentBackground ?? path
  }
  return location
}

export function PartnerDetailLink({ id, ...props }: Omit<LinkProps, 'to'> & { id: string }) {
  const location = useLocation()
  return <Link {...props} to={PARTNERS_PATH + '/' + encodeURIComponent(id)} state={{ documentBackground: registerBackground(location) }} />
}

export function DocumentLink({ id, ...props }: Omit<LinkProps, 'to'> & { id: string }) {
  const location = useLocation()
  const withinDocument = Boolean(matchPath(DOCUMENTS_PATH + '/:id', location.pathname))
  return <Link {...props} to={DOCUMENTS_PATH + '/' + encodeURIComponent(id)} replace={withinDocument}
    state={{ documentBackground: withinDocument ? location.state?.documentBackground : registerBackground(location) }} />
}

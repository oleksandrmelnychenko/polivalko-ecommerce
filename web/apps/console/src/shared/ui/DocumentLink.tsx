import { createContext } from 'react'
import { Link, matchPath, useLocation, type LinkProps, type Location } from 'react-router-dom'

export const DocumentOverlayContext = createContext(false)

function registerBackground(location: Location) {
  for (const path of ['/accounting/documents', '/accounting/partners']) {
    if (matchPath(path + '/:id', location.pathname)) return location.state?.documentBackground ?? path
  }
  return location
}

export function PartnerDetailLink({ id, ...props }: Omit<LinkProps, 'to'> & { id: string }) {
  const location = useLocation()
  return <Link {...props} to={'/accounting/partners/' + encodeURIComponent(id)} state={{ documentBackground: registerBackground(location) }} />
}

export function DocumentLink({ id, ...props }: Omit<LinkProps, 'to'> & { id: string }) {
  const location = useLocation()
  const withinDocument = Boolean(matchPath('/accounting/documents/:id', location.pathname))
  return <Link {...props} to={'/accounting/documents/' + encodeURIComponent(id)} replace={withinDocument}
    state={{ documentBackground: withinDocument ? location.state?.documentBackground : registerBackground(location) }} />
}

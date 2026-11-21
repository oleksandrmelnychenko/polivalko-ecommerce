import { createContext } from 'react'
import { Link, matchPath, useLocation, type LinkProps } from 'react-router-dom'

export const DocumentOverlayContext = createContext(false)

export function DocumentLink({ id, ...props }: Omit<LinkProps, 'to'> & { id: string }) {
  const location = useLocation()
  const withinDocument = Boolean(matchPath('/accounting/documents/:id', location.pathname))
  return <Link {...props} to={'/accounting/documents/' + encodeURIComponent(id)} replace={withinDocument}
    state={{ documentBackground: withinDocument ? location.state?.documentBackground : location }} />
}

import Image from 'next/image'
import { Link } from 'react-router-dom'

export function ConsoleBrand({ onClick }: { onClick?: () => void }) {
  return (
    <Link to="/" onClick={onClick} className="console-brand" aria-label="На головну консолі Poli-Valko" translate="no">
      <Image src="/mascot/poli-valka-poster.png" width={29} height={46} alt="" unoptimized />
      <span className="console-brand-word">Poli-Valko</span>
    </Link>
  )
}

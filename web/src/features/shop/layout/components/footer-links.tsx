import Link from "next/link";

export function FooterLinks({ links }: { links: { href: string; label: string }[] }) {
  return (
    <ul className="footer__links">
      {links.map((link) => (
        <li key={link.label}>
          <Link href={link.href}>{link.label}</Link>
        </li>
      ))}
    </ul>
  );
}

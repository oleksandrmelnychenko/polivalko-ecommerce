import Link from "next/link";
import { customerPages } from "@/shared/lib/customer-pages";
import "../styles/customer-page-nav.css";

export function CustomerPageNav({ path }: { path?: string }) {
  if (!customerPages.some(page => page.href === path)) return null;
  return (
    <nav className="customer-page-nav" aria-label="Інформація для клієнтів">
      {customerPages.map(({ href, label }) => (
        <Link key={href} href={href} aria-current={path === href ? "page" : undefined}>{label}</Link>
      ))}
    </nav>
  );
}

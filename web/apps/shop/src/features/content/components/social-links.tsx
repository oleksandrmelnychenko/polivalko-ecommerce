import type { SocialLink } from "../lib/social-links";

function SocialIcon({ name }: { name: string }) {
  const brand = name.split(" · ")[0];
  return <svg className={`social-links__icon social-links__icon--${brand.toLowerCase()}`} viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    {brand === "Instagram" && <g fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r=".8" fill="currentColor" stroke="none" /></g>}
    {brand === "Facebook" && <><circle cx="12" cy="12" r="11" fill="currentColor" /><path d="M13.6 22v-8.3h2.8l.4-3.2h-3.2V8.4c0-.9.3-1.5 1.6-1.5h1.7V4.1c-.3 0-1.3-.1-2.5-.1-2.5 0-4.1 1.5-4.1 4.2v2.3H7.6v3.2h2.7V22" fill="#fff" /></>}
    {brand === "Telegram" && <><circle cx="12" cy="12" r="11" fill="currentColor" /><path d="m5.2 11.8 13-5c.6-.2 1 .1.8.9l-2.2 10.4c-.2.8-.6 1-1.2.6l-3.4-2.5-1.7 1.6c-.2.2-.3.3-.6.3l.3-3.5 6.4-5.8c.3-.3-.1-.4-.5-.1l-7.9 5-3.4-1.1c-.7-.2-.7-.6.4-.8Z" fill="#fff" /></>}
    {brand === "Viber" && <><path d="M5 3c4-2 10-2 14 0 3 2 3 12 0 15-2 2-6 2-8 2l-4 3v-4c-5-1-6-13-2-16Z" fill="currentColor" /><g fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6 6.5 8c1.2 4.3 3.2 6.3 7.5 7.5l2-1.5-2-2-1.4 1c-2-.8-3.3-2.1-4.1-4.1l1-1.4Z" /><path d="M13 5a6 6 0 0 1 5 5M13 8a3 3 0 0 1 2 2" /></g></>}
    {brand === "YouTube" && <><rect x="1" y="4" width="22" height="16" rx="5" fill="currentColor" /><path d="m10 8 6 4-6 4Z" fill="#fff" /></>}
  </svg>;
}

export function SocialLinksList({ links, iconsOnly = false }: { links: SocialLink[]; iconsOnly?: boolean }) {
  return <ul className={`social-links${iconsOnly ? " social-links--icons" : ""}`}>{links.map(link => <li key={link.name}>
    {link.placeholder ? <span className="social-links__item" role="link" aria-disabled="true" aria-label={`${link.name}: посилання ще не налаштовано`} title={`${link.name}: посилання ще не налаштовано`}><SocialIcon name={link.name} />{!iconsOnly && <span>{link.name.split(" · ")[0]}</span>}</span> : <a className="social-links__item" href={link.url} target="_blank" rel="noopener noreferrer" aria-label={iconsOnly ? link.name : undefined} title={link.name}><SocialIcon name={link.name} />{!iconsOnly && <span>{link.name.split(" · ")[0]}</span>}</a>}
  </li>)}</ul>;
}

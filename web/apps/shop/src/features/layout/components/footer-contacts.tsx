import { connection } from "next/server";
import Link from "@/shared/ui/idle-link";
import { getContacts, socialLinks, SpecialDays } from "@/features/content/server";
import { ClockIcon, PhoneIcon, PinIcon } from "@polivalko/shared/ui/icons";
import { SocialLinksList } from "@/features/content/server";
import { contactPhones } from "../lib/contact-phones";

export async function FooterContacts() {
  await connection();
  const contacts = await getContacts().catch(() => null);
  const socials = socialLinks(contacts);
  return (
    <>
      <ul className="footer__contacts">
        {contacts?.email && <li className="footer__email"><a href={"mailto:" + contacts.email}>{contacts.email}</a></li>}
        {contactPhones(contacts).map(({ label, number, dial }) => (
          <li className="footer__phone" key={dial}><PhoneIcon /><a href={`tel:${dial}`} aria-label={`${label}: ${number}`}>{number}</a></li>
        ))}
        {contacts?.schedule && (
          <li>
            <ClockIcon />
            <div>
              <span>{contacts.schedule}</span>
              <SpecialDays days={contacts.specialDays} limit={3} />
            </div>
          </li>
        )}
        {socials.length > 0 && <li className="footer__social-row"><SocialLinksList links={socials} /></li>}
        <li>
          <PinIcon />
          {contacts?.mapUrl
            ? <a href={contacts.mapUrl} target="_blank" rel="noopener noreferrer">Як нас знайти</a>
            : <Link href="/contacts">Як нас знайти</Link>}
        </li>
      </ul>
    </>
  );
}

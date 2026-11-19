import { connection } from "next/server";
import { getContacts, socialLinks, SpecialDays } from "@/features/content/server";
import { ClockIcon, PhoneIcon, PinIcon } from "@polivalko/shared/ui/icons";
import { SocialLinksList } from "@/features/content/server";

export async function FooterContacts() {
  await connection();
  const contacts = await getContacts().catch(() => null);
  const socials = socialLinks(contacts);
  return (
    <>
      <ul className="footer__contacts">
        {contacts?.storePhone && <li className="footer__phone"><PhoneIcon /><a href={`tel:${contacts.storePhone.replace(/[^\d+]/g, "")}`}>{contacts.storePhone}</a></li>}
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
          {contacts?.email && (
            <li>
              <a href={`mailto:${contacts.email}`}>{contacts.email}</a>
            </li>
          )}
        <li><PinIcon />{contacts?.mapUrl ? <a href={contacts.mapUrl} target="_blank" rel="noopener noreferrer">{contacts.address}</a> : <span>{contacts?.address ?? "Буча, Київська область"}</span>}</li>
      </ul>
    </>
  );
}

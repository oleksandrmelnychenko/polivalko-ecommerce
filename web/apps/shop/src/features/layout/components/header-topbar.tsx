import { connection } from "next/server";
import Link from "@/shared/ui/idle-link";
import { getContacts, socialLinks, SocialLinksList } from "@/features/content/server";
import { PinIcon } from "@polivalko/shared/ui/icons";
import { contactPhones } from "../lib/contact-phones";

export async function HeaderTopbar() {
  await connection();
  const contacts = await getContacts().catch(() => null);
  const socials = socialLinks(contacts);
  const city = contacts?.address?.split(",")[0]?.trim();
  const phones = contactPhones({ storePhone: contacts?.storePhone, schedule: contacts?.schedule });
  if (!city && phones.length === 0 && socials.length === 0) return null;
  return (
    <div className="site-header__top">
      <div className="container site-header__top-inner">
        {city ? (
          <Link href="/contacts" className="site-header__city">
            <PinIcon />
            {city}
          </Link>
        ) : (
          <span />
        )}
        <div className="site-header__reach">
          {socials.length > 0 && (
            <SocialLinksList links={socials} iconsOnly />
          )}
          {phones.map(({ label, number, dial, schedule }) => (
            <span className="site-header__phone" key={dial}>
              <a href={`tel:${dial}`} aria-label={`${label}: ${number}`}>{number}</a>
              {schedule && <small title={schedule}>{schedule}</small>}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

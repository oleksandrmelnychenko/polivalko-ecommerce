import { connection } from "next/server";
import Link from "next/link";
import { getContacts, socialLinks } from "@/features/content/server";
import { PhoneIcon, PinIcon } from "@polivalko/shared/ui/icons";
import { SocialLinksList } from "@/features/content/server";

export async function HeaderTopbar() {
  await connection();
  const contacts = await getContacts().catch(() => null);
  const socials = socialLinks(contacts);
  const city = contacts?.address?.split(",")[0]?.trim();
  if (!city && !contacts?.storePhone && socials.length === 0) return null;
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
          {contacts?.storePhone && (
            <span className="site-header__phone">
              <PhoneIcon />
              <span>
                <a href={`tel:${contacts.storePhone.replace(/[^\d+]/g, "")}`}>{contacts.storePhone}</a>
                {contacts.schedule && <small>{contacts.schedule}</small>}
              </span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

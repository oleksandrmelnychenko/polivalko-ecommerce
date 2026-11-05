import { connection } from "next/server";
import { getContacts, socialLinks, SpecialDays } from "@/features/content/server";
import { ClockIcon, PhoneIcon, PinIcon } from "@polivalko/shared/ui/icons";

export async function FooterContacts() {
  await connection();
  const contacts = await getContacts();
  const socials = socialLinks(contacts);
  return (
    <>
      <ul className="footer__contacts">
        <li>
          <PinIcon />
          <span>{contacts?.address ?? <span className="fill">Буча, адреса уточнюється</span>}</span>
        </li>
        <li>
          <ClockIcon />
          <div>
            <span>{contacts?.schedule ?? <span className="fill">графік уточнюється</span>}</span>
            <SpecialDays days={contacts?.specialDays} limit={3} />
          </div>
        </li>
        {contacts?.storePhone && (
          <li>
            <PhoneIcon />
            <span>
              Телефон: <a href={`tel:${contacts.storePhone.replace(/[^\d+]/g, "")}`}>{contacts.storePhone}</a>
            </span>
          </li>
        )}
      </ul>
      {(contacts?.email || socials.length > 0) && (
        <ul className="footer__social">
          {contacts?.email && (
            <li>
              <a href={`mailto:${contacts.email}`}>{contacts.email}</a>
            </li>
          )}
          {socials.map((s) => (
            <li key={s.name}>
              <a href={s.url} target="_blank" rel="noopener">
                {s.name}
              </a>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

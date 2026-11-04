import { connection } from "next/server";
import { getContacts } from "@/features/content/server";
import { ClockIcon, PhoneIcon, PinIcon } from "@polivalko/shared/ui/icons";

export async function FooterContacts() {
  await connection();
  const contacts = await getContacts();
  return (
    <ul className="footer__contacts">
      <li>
        <PinIcon />
        <span>{contacts?.address ?? <span className="fill">Буча, адреса уточнюється</span>}</span>
      </li>
      <li>
        <ClockIcon />
        <span>{contacts?.schedule ?? <span className="fill">графік уточнюється</span>}</span>
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
  );
}

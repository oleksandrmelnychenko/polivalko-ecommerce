import type { Contacts } from "@polivalko/shared/api/types";

export type SocialLink = { name: string; url: string };

export function socialLinks(contacts: Contacts | null | undefined): SocialLink[] {
  return [
    { name: contacts?.instagram?.replace(/\/$/, "") === "https://www.instagram.com/poli_valko" ? "Instagram · @poli_valko" : "Instagram", url: contacts?.instagram },
    { name: "Facebook", url: contacts?.facebook },
    { name: "Telegram", url: contacts?.telegram },
    { name: "Viber", url: contacts?.viber },
    { name: "YouTube", url: contacts?.youTube },
  ].filter((s): s is SocialLink => Boolean(s.url?.trim()));
}

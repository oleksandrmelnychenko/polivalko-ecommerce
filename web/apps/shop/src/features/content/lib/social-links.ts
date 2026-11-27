import type { Contacts } from "@polivalko/shared/api/types";

export type SocialLink = { name: string; url: string; placeholder?: boolean };

export function isRealSocialProfile(url: string): boolean {
  if (!/^https?:/i.test(url)) return true;
  if (!URL.canParse(url)) return false;
  const parsed = new URL(url);
  return parsed.pathname.replace(/\/+$/, "").length > 0 || Boolean(parsed.search || parsed.hash);
}

export function socialLinks(contacts: Contacts | null | undefined): SocialLink[] {
  return [
    { name: contacts?.instagram?.replace(/\/$/, "") === "https://www.instagram.com/poli_valko" ? "Instagram · @poli_valko" : "Instagram", url: contacts?.instagram },
    { name: "Facebook", url: contacts?.facebook },
    { name: "Telegram", url: contacts?.telegram },
    { name: "Viber", url: contacts?.viber },
    { name: "YouTube", url: contacts?.youTube },
  ].filter((s): s is SocialLink => Boolean(s.url?.trim())).map(s => ({ ...s, placeholder: /^https?:\/\/example\.com(?:\/|$)/i.test(s.url) }));
}

export function activeSocialLinks(contacts: Contacts | null | undefined): SocialLink[] {
  return socialLinks(contacts).filter((item) => !item.placeholder && isRealSocialProfile(item.url));
}

import type { Contacts } from "@polivalko/shared/api/types";
import type { OrganizationSource } from "@/features/seo";
import { socialLinks } from "./social-links";

export function organizationSource(contacts: Contacts | null, seller: OrganizationSource["seller"]): OrganizationSource {
  return {
    contacts,
    seller,
    sameAs: socialLinks(contacts)
      .map((link) => link.url.trim())
      .filter((url) => /^https?:\/\//i.test(url)),
  };
}

import type { ReactNode } from "react";
import { BagIcon, TagIcon, UserIcon } from "@/shared/ui/icons";
import type { components } from "@/shared/api/schema";
import { formatDateTime, formatMoney } from "@/shared/lib/format";
import { orderStatusLabel } from "@/shared/lib/labels";

export type SearchResult = components["schemas"]["AdminSearchDto"];
export type PaletteSection = { href: string; label: string; icon: ReactNode };
export type PaletteItem = { key: string; href: string; icon: ReactNode; image?: string | null; title: string; sub: string; side?: string };
export type PaletteGroup = { title: string; items: PaletteItem[] };

export function paletteGroups(term: string, sections: PaletteSection[], result: { q: string; data: SearchResult | null } | null): PaletteGroup[] {
  const groups: PaletteGroup[] = [];
  if (term.length < 2) {
    groups.push({
      title: "Перейти",
      items: sections.map((s) => ({ key: s.href, href: s.href, icon: s.icon, title: s.label, sub: s.href })),
    });
  } else if (result?.data && result.q === term) {
    const { orders, products, customers } = result.data;
    if (orders.length)
      groups.push({
        title: "Замовлення",
        items: orders.map((o) => ({
          key: `o-${o.number}`,
          href: `/admin/orders/${o.number}`,
          icon: <BagIcon />,
          title: `${o.number} · ${o.customerName}`,
          sub: `${orderStatusLabel[o.status]} · ${formatDateTime(o.createdAt)} · ${o.phone}`,
          side: formatMoney(o.total),
        })),
      });
    if (products.length)
      groups.push({
        title: "Товари",
        items: products.map((p) => ({
          key: `p-${p.id}`,
          href: `/admin/catalog/products/${p.id}`,
          icon: <TagIcon />,
          image: p.imageUrl,
          title: p.name,
          sub: `${p.sku}${p.isVisible ? "" : " · прихований"}`,
          side: formatMoney(p.price),
        })),
      });
    if (customers.length)
      groups.push({
        title: "Покупці",
        items: customers.map((c) => ({
          key: `c-${c.phone}`,
          href: `/admin/orders?q=${encodeURIComponent(c.phone)}`,
          icon: <UserIcon />,
          title: c.name,
          sub: c.phone,
          side: `${c.orders} замовл.`,
        })),
      });
  }
  return groups;
}

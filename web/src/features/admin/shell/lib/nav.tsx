import type { ReactNode } from "react";
import { BagIcon, ClipboardIcon, FileTextIcon, GridIcon, ListIcon, PlugIcon, TagIcon, UserIcon, UsersIcon } from "@/shared/ui/icons";
import type { components } from "@/shared/api/schema";

export type Summary = components["schemas"]["AdminSummaryDto"];
export type NavLink = { href: string; label: string; icon: ReactNode; adminOnly: boolean; badge?: (s: Summary) => number };

export const groups: { title: string; links: NavLink[] }[] = [
  {
    title: "Продажі",
    links: [
      { href: "/admin", label: "Огляд", icon: <GridIcon />, adminOnly: false },
      { href: "/admin/orders", label: "Замовлення", icon: <BagIcon />, adminOnly: false, badge: (s) => s.newOrders + s.awaitingConfirmation },
      { href: "/admin/customers", label: "Покупці", icon: <UserIcon />, adminOnly: false },
      { href: "/admin/requests", label: "Заявки", icon: <ClipboardIcon />, adminOnly: false, badge: (s) => s.newServiceRequests },
    ],
  },
  {
    title: "Магазин",
    links: [
      { href: "/admin/catalog", label: "Каталог", icon: <TagIcon />, adminOnly: false },
      { href: "/admin/content", label: "Контент", icon: <FileTextIcon />, adminOnly: true },
    ],
  },
  {
    title: "Система",
    links: [
      { href: "/admin/integration", label: "Інтеграції", icon: <PlugIcon />, adminOnly: false, badge: (s) => s.failedOperations },
      { href: "/admin/staff", label: "Працівники", icon: <UsersIcon />, adminOnly: true },
      { href: "/admin/audit", label: "Журнал", icon: <ListIcon />, adminOnly: true },
    ],
  },
];

export const isCurrent = (href: string, pathname: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

"use client";

import { useStaff } from "@/features/auth";
import { groups } from "../lib/nav";

export function useLinks() {
  const { isAdmin } = useStaff();
  return groups.map((g) => ({ ...g, links: g.links.filter((l) => isAdmin || !l.adminOnly) })).filter((g) => g.links.length > 0);
}

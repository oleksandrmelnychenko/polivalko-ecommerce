"use client";

import { createContext, useContext, useOptimistic, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { hrefFor, type Parsed } from "../lib/listing-params";

type ListingState = {
  selection: Parsed;
  pending: boolean;
  apply: (patch: Partial<Parsed>) => void;
};

const Navigation = createContext<ListingState | null>(null);

export function ListingNavigation({ basePath, fixed, parsed, children }: {
  basePath: string;
  fixed: Record<string, string>;
  parsed: Parsed;
  children: ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selection, setSelection] = useOptimistic(parsed);

  function apply(patch: Partial<Parsed>) {
    const next = { ...selection, ...patch, page: 1 };
    const href = hrefFor(basePath, fixed, next, {});
    if (href === hrefFor(basePath, fixed, selection, {})) return;
    startTransition(() => {
      setSelection(next);
      router.push(href, { scroll: false });
    });
  }

  return <Navigation.Provider value={{ selection, pending, apply }}>{children}</Navigation.Provider>;
}

export function useListingNavigation() {
  const navigation = useContext(Navigation);
  if (!navigation) throw new Error("ListingNavigation provider is missing");
  return navigation;
}

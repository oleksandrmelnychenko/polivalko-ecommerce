"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, type MouseEvent, type ReactNode } from "react";

/**
 * Головне меню: підменю відкриваються CSS-ом при наведенні й фокусі. Після переходу за посиланням
 * підменю ховається, доки курсор не залишить меню, — інакше воно висіло б над новою сторінкою.
 */
export function MainNav({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    if (!closed) return;
    (document.activeElement as HTMLElement | null)?.blur();
  }, [closed, pathname]);

  function onClick(event: MouseEvent<HTMLElement>) {
    if ((event.target as HTMLElement).closest("a")) setClosed(true);
  }

  return (
    <nav className="site-nav" aria-label="Головне меню" data-closed={closed || undefined} onClick={onClick} onPointerLeave={() => setClosed(false)}>
      <ul className="site-nav__list">{children}</ul>
    </nav>
  );
}

import { useEffect, useRef, type RefObject } from "react";
import type { CompareProduct } from "./model";

export function ComparisonColumnNames({ products, scrollRef }: {
  products: CompareProduct[];
  scrollRef: RefObject<HTMLDivElement | null>;
}) {
  const namesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const names = namesRef.current;
    const scroller = scrollRef.current;
    const cards = scroller?.querySelector("thead");
    if (!names || !scroller || !cards) return;

    const header = document.querySelector(".site-header");
    let observer: IntersectionObserver;

    const alignColumns = () => { names.scrollLeft = scroller.scrollLeft; };
    const watchCards = () => {
      const top = header?.getBoundingClientRect().height ?? 0;
      names.style.top = `${top}px`;
      observer?.disconnect();
      observer = new IntersectionObserver(([entry]) => {
        names.toggleAttribute("data-pinned", entry.boundingClientRect.bottom <= top);
        alignColumns();
      }, { rootMargin: `-${top}px 0px 0px` });
      observer.observe(cards);
    };

    watchCards();
    const resize = new ResizeObserver(() => { watchCards(); alignColumns(); });
    if (header) resize.observe(header);
    resize.observe(scroller);
    scroller.addEventListener("scroll", alignColumns, { passive: true });
    return () => {
      observer.disconnect();
      resize.disconnect();
      scroller.removeEventListener("scroll", alignColumns);
    };
  }, [scrollRef]);

  return (
    <div className="comparison-column-names" ref={namesRef} aria-hidden="true">
      <div>{products.map(product => <span key={product.id}>{product.name}</span>)}</div>
    </div>
  );
}

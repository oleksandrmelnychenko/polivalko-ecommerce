import type { ReactNode } from "react";
import { sized } from "@/shared/lib/images";
import { Heading } from "./heading";

const LOOK_SIZES = "(max-width: 60rem) 100vw, 33vw";

export function Look({ id, title, sub, ghost, photo, reverse, children }: { id: string; title: string; sub: string; ghost: string; photo?: { url: string; alt: string }; reverse?: boolean; children: ReactNode }) {
  return (
    <section className={reverse ? "look look--reverse" : "look"} aria-labelledby={id}>
      <figure className="look__photo">{photo && <img {...sized(photo.url, LOOK_SIZES, 960)} alt={photo.alt} width={960} height={1280} loading="lazy" fetchPriority="low" decoding="async" />}</figure>
      <p className={reverse ? "look__ghost look__ghost--down" : "look__ghost"} aria-hidden="true">
        {ghost}
      </p>
      <div className="look__content">
        <Heading id={id} title={title} sub={sub} />
        {children}
      </div>
    </section>
  );
}

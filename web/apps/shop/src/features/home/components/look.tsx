import Link from "next/link";
import type { ReactNode } from "react";
import { portrait } from "@polivalko/shared/lib/images";
import { ArrowRightIcon } from "@polivalko/shared/ui/icons";
import { Heading } from "./heading";

const LOOK_SIZES = "(max-width: 60rem) 100vw, 36vw";

export function Look({
  id,
  title,
  sub,
  ghost,
  photo,
  more,
  reverse,
  children,
}: {
  id: string;
  title: string;
  sub?: string;
  ghost: string;
  photo?: { url: string; alt: string };
  more?: { href: string; label: string };
  reverse?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={reverse ? "look look--reverse" : "look"} aria-labelledby={id}>
      <figure className="look__photo">
        {photo && <img {...portrait(photo.url, LOOK_SIZES)} alt={photo.alt} width={800} height={1200} loading="lazy" fetchPriority="low" decoding="async" />}
        <figcaption className="look__caption">
          <span className="look__word" aria-hidden="true">
            {ghost}
          </span>
          {more && (
            <Link href={more.href} className="look__go" aria-label={more.label} title={more.label}>
              <ArrowRightIcon />
            </Link>
          )}
        </figcaption>
      </figure>
      <div className="look__content">
        <Heading id={id} title={title} sub={sub} />
        {children}
      </div>
    </section>
  );
}

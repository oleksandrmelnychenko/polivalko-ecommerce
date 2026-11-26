import "../styles/category-service-link.css";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ArrowRightIcon } from "@polivalko/shared/ui/icons";
import { getServiceDirections } from "../api/server";
import { serviceCodeForCategory } from "../lib/category-services";
import { servicePath } from "../lib/service-groups";

type Props = { slug: string; ancestors: readonly { slug: string }[] };

/** A card under a catalog section that leads to the matching service page, e.g. watering → irrigation installation. */
export function CategoryServiceLink(props: Props) {
  if (!serviceCodeForCategory(props.slug, props.ancestors)) return null;
  return (
    <Suspense fallback={null}>
      <ServiceCard {...props} />
    </Suspense>
  );
}

async function ServiceCard({ slug, ancestors }: Props) {
  await connection();
  const code = serviceCodeForCategory(slug, ancestors);
  const service = (await getServiceDirections().catch(() => [])).find((s) => s.code === code);
  if (!service) return null; // hidden in the console

  return (
    <aside className="category-service" aria-label="Послуга">
      <p className="category-service__kicker">Садові послуги в Бучі</p>
      <h2 className="category-service__name">{service.name}</h2>
      {service.description && <p className="category-service__text">{service.description}</p>}
      <Link href={servicePath(service.slug)} className="btn btn--graphite category-service__go">
        Про послугу <ArrowRightIcon />
      </Link>
    </aside>
  );
}

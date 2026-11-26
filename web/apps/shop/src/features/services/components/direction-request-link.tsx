import Link from "next/link";
import { ArrowRightIcon } from "@polivalko/shared/ui/icons";
import type { ServiceDirection } from "@polivalko/shared/api/types";
import { servicePath } from "../lib/service-groups";

/** A service in the list: opens its page, where the request button already has this service chosen. */
export function DirectionRequestLink({ service }: { service: ServiceDirection }) {
  return (
    <Link className="garden-work" href={servicePath(service.slug)} aria-label={`Послуга «${service.name}»`}>
      <div>
        <h3>{service.name}</h3>
        {service.description && <p>{service.description}</p>}
      </div>
      <span className="garden-work__action" aria-hidden="true"><ArrowRightIcon /></span>
    </Link>
  );
}

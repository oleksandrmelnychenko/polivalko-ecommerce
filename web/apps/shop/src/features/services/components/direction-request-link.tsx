import Link from "next/link";
import { ArrowRightIcon } from "@polivalko/shared/ui/icons";
import type { ServiceDirection } from "@polivalko/shared/api/types";

export function DirectionRequestLink({ service }: { service: ServiceDirection }) {
  return (
    <Link className="garden-work" href={`/contacts?direction=${encodeURIComponent(service.code)}#request`}
      aria-label={`Заявка на послугу «${service.name}»`}>
      <div>
        <h3>{service.name}</h3>
        {service.description && <p>{service.description}</p>}
      </div>
      <span className="garden-work__action" aria-hidden="true"><ArrowRightIcon /></span>
    </Link>
  );
}

import Link from "next/link";
import type { ServiceDirection } from "@polivalko/shared/api/types";
import { ArrowRightIcon } from "@polivalko/shared/ui/icons";
import { DirectionRequestLink } from "./direction-request-link";

type ServiceGroup = {
  key: string;
  label: string;
  title: string;
  photo: string;
  services: ServiceDirection[];
};

// Coordinates follow the 1536 × 1024 garden illustration.
const planZones: Partial<Record<string, { area: string; accent: string }>> = {
  landscape: {
    area: "M28 425 Q170 445 292 468 Q380 455 455 425 L600 394 Q541 438 435 475 Q358 509 358 558 Q360 624 503 660 Q630 679 738 743 L886 804 L879 918 L30 941 Z",
    accent: "M464 870 C593 819 563 747 453 680 S299 575 357 500 Q391 451 500 425",
  },
  irrigation: {
    area: "M362 559 Q355 488 505 439 Q653 390 736 337 Q828 304 1022 331 L1078 365 Q1046 418 1013 481 Q994 532 981 581 Q994 646 1053 667 Q959 749 798 737 Q709 724 616 681 Q532 648 452 626 Q379 607 362 559 Z",
    accent: "M925 540 Q848 387 702 464 M925 540 Q891 412 809 418 M925 540 Q918 449 878 439",
  },
  care: {
    area: "M576 85 Q625 0 747 10 Q842 19 887 63 Q962 28 1093 34 L1443 43 L1477 319 L1400 370 L1131 344 Q1041 307 965 314 Q844 292 733 333 L621 362 Q620 303 575 280 Z",
    accent: "M1238 331 L1403 332 L1397 301 L1237 302 Z M1216 269 L1373 270 L1369 240 L1214 240 Z M1178 201 L1307 201 L1304 176 L1177 176 Z",
  },
};

export function ServiceGallery({ groups }: { groups: ServiceGroup[] }) {
  return <>
    <header className="garden-cover">
      <div className="garden-cover__copy">
        <h1>Послуги<br /><em>для саду</em></h1>
        {groups.length > 0 && <p>Оберіть напрям на плані ділянки, щоб переглянути послуги.</p>}
        <Link className="garden-cover__cta" href={groups.length ? "/contacts#request" : "/contacts"}>
          Обговорити роботи <ArrowRightIcon />
        </Link>
      </div>
      <div className="garden-plan">
        <img className="garden-plan__image" src="/brand/garden-plan.webp" alt="План саду з газоном, квітниками й плодовими деревами" fetchPriority="high" width={1536} height={1024} />
        {groups.map(group => {
          const zone = planZones[group.key];
          return <a key={group.key} href={`#${group.key}`} className="garden-zone">
            {zone && <svg viewBox="0 0 1536 1024" className="garden-zone__overlay" aria-hidden="true" focusable="false">
              <path className="garden-zone__area" d={zone.area} />
              <path className="garden-zone__accent" d={zone.accent} pathLength="1" />
            </svg>}
            <span className={`garden-pin garden-pin--${group.key}`}>{group.label}</span>
          </a>;
        })}
      </div>
    </header>
    <div className="garden-scenes">
      {groups.map(group => <section key={group.key} className={`garden-scene garden-scene--${group.key}`}
        id={group.key} aria-labelledby={`title-${group.key}`}>
        <div className="garden-scene__photo"><img src={group.photo} alt="" width={1080} height={740} loading="lazy" /></div>
        <div className="garden-scene__body">
          <h2 id={`title-${group.key}`}>{group.title}</h2>
          <ul className="garden-works">
            {group.services.map(service => <li key={service.code}><DirectionRequestLink service={service} /></li>)}
          </ul>
        </div>
      </section>)}
    </div>
  </>;
}

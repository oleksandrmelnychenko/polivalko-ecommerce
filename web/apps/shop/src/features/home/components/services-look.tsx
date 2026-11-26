import Link from "next/link";
import { connection } from "next/server";
import { getServiceDirections, servicePath } from "@/features/services/server";
import { ArrowRightIcon } from "@polivalko/shared/ui/icons";
import { pagePhotos } from "@polivalko/shared/lib/stand-in-photos";
import { sized } from "@/shared/lib/images";
import { HomeSection } from "./home-section";

export async function ServicesLook() {
  await connection();
  const directions = await getServiceDirections().catch(() => []);
  if (directions.length === 0) return null;
  return (
    <HomeSection id="services-title" title="Послуги для саду" sub="Ландшафтний дизайн, озеленення, автополив і догляд." more={{ href: "/services", label: "Усі послуги" }}>
      <ul className="service-cards">
        {directions.map((d, index) => (
          <li key={d.code} className={index === 0 ? "service-cards__featured" : undefined}>
            <Link href={servicePath(d.slug)} className={index === 0 ? "service-card service-card--featured" : "service-card"}>
              {index === 0 && <img className="service-card__photo" {...sized(pagePhotos.services.url, "(max-width: 48rem) 100vw, 40vw", 960)} alt="" width={640} height={800} loading="lazy" decoding="async" />}
              <span className="service-card__name">{d.name}</span>
              {d.description && <span className="service-card__text">{d.description}</span>}
              <span className="service-card__go" aria-hidden="true">
                <ArrowRightIcon />
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="services-look__cta">
        <p>Потрібна консультація? <span>Залиште заявку — обговоримо роботи на вашій ділянці.</span></p>
        <Link href="/contacts#request" className="btn">
          Залишити заявку
        </Link>
      </div>
    </HomeSection>
  );
}

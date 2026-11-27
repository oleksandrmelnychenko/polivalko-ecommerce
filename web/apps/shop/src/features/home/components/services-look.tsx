import Link from "next/link";
import { connection } from "next/server";
import { getServiceDirections, servicePath } from "@/features/services/server";
import { ArrowRightIcon } from "@polivalko/shared/ui/icons";
import { serviceIcon } from "@polivalko/shared/ui/service-icon";

export async function ServicesLook() {
  await connection();
  const directions = await getServiceDirections().catch(() => []);
  if (directions.length === 0) return null;
  return (
    <section id="home-services" className="container home-section" aria-labelledby="services-title">
      <div className="home-services">
        <header>
          <h2 id="services-title">Послуги для саду</h2>
          <Link className="home-section__more" href="/services">Усі послуги <ArrowRightIcon /></Link>
        </header>
        <ul>
          {directions.map((direction) => {
            const Icon = serviceIcon(direction.code);
            return (
              <li key={direction.code}>
                <Link href={servicePath(direction.slug)}>
                  <span className="menu-category-symbol" aria-hidden="true"><Icon size={18} stroke={1.7} /></span>
                  <span>{direction.name}</span>
                  <ArrowRightIcon aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>
        <Link href="/contacts#request" className="btn">Залишити заявку <ArrowRightIcon /></Link>
      </div>
    </section>
  );
}

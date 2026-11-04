import Link from "next/link";
import { connection } from "next/server";
import { getServiceDirections } from "@/features/services/server";
import { pagePhotos } from "@polivalko/shared/lib/stand-in-photos";
import { Look } from "./look";

export async function ServicesLook() {
  await connection();
  const directions = await getServiceDirections();
  return (
    <Look id="services-title" title="Послуги для саду" sub="Проєктуємо, монтуємо й доглядаємо" ghost="Сад під ключ" photo={pagePhotos.services} reverse>
      <ol className="directions">
        {directions.map((d) => (
          <li key={d.code}>
            <Link href="/services">
              <span className="directions__name">{d.name}</span>
              {d.description && <span className="directions__text">{d.description}</span>}
            </Link>
          </li>
        ))}
      </ol>
      <p className="look__more">
        <Link href="/services" className="btn">
          Замовити дзвінок
        </Link>
      </p>
    </Look>
  );
}

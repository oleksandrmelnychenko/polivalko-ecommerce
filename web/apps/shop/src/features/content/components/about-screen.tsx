import Link from "next/link";
import { ArrowRightIcon, PinIcon } from "@polivalko/shared/ui/icons";
import { aboutPageJsonLd, breadcrumbJsonLd, JsonLd, seoMetadata } from "@/features/seo";
import { Breadcrumbs } from "@/shared/ui/breadcrumbs";

const ABOUT_DESCRIPTION =
  "Садовий центр Poli Valko у Бучі (ТК «Варшавський»): 4 900+ товарів для поливу, саду й городу, монтаж автополиву та озеленення по Київщині.";

export const metadata = seoMetadata({
  title: "Про інтернет-магазин і садовий центр у Бучі",
  description: ABOUT_DESCRIPTION,
  path: "/about",
});

const ranges = [
  { slug: "vse-dlia-polyvu", title: "Все для поливу", examples: "Шланги Cellfast, крапельний полив, Hunter та Irritec" },
  { slug: "vse-dlia-roslyn", title: "Все для рослин", examples: "Насіння SeedEra, ґрунти, добрива Agrecol і ЗЗР" },
  { slug: "ruchnyi-instrument", title: "Ручний інструмент", examples: "Секатори Fiskars, лопати, граблі, пили й сокири" },
  { slug: "landshaftnyi-dyzain", title: "Ландшафтний дизайн", examples: "Газонні трави, бордюри, агроволокно, опори" },
  { slug: "tekhnika-dlia-sadu-ta-horodu", title: "Садова техніка", examples: "Техніка для догляду за ділянкою та витратні матеріали" },
  { slug: "vse-dlia-vidpochynku", title: "Для відпочинку", examples: "Басейни, хімія для води, грилі та товари для пікніка" },
];

export default function AboutPage() {
  return (
    <div className="container story-page">
      <Breadcrumbs current="Про нас" />
      <JsonLd data={breadcrumbJsonLd([{ name: "Про нас", path: "/about" }])} />
      <JsonLd data={aboutPageJsonLd({ name: "Про магазин Poli Valko", description: ABOUT_DESCRIPTION, path: "/about" })} />
      <div className="story-intro">
        <header className="story-cover garden-print">
          <div className="story-cover__text">
            <h1>Про магазин Poli Valko</h1>
            <p>
              Poli Valko («Полі Валко») — спеціалізований садовий центр та інтернет-магазин у Бучі для тих, хто
              облаштовує систему поливу, доглядає за садом, вирощує врожай і впорядковує ділянку.
            </p>
            <p>
              Наш офлайн-магазин розташований за адресою: м. Буча, вул. Депутатська, 1-В, ТК «Варшавський», фасадний
              ряд, приміщення №8–12. Працюємо щодня: Пн–Сб 09:00–18:00, Нд 10:00–17:00.
            </p>
            <Link href="/contacts#store"><PinIcon /> Де нас знайти та графік роботи</Link>
          </div>
        </header>
        <section className="story-shop info-sheet" aria-labelledby="story-shop-title">
          <div className="story-copy">
            <h2 id="story-shop-title">Асортимент і підбір без зайвих витрат</h2>
            <p>
              У каталозі зібрано понад 4 900 позицій від понад 60 перевірених виробників — зокрема Hunter, Irritec,
              Cellfast, Gardena, Fiskars, Truper, SeedEra, Agrecol, Valagro та Syngenta. У магазині в Бучі можна
              оглянути комплектуючі наживо й отримати практичну пораду: підберемо фітинги під діаметр труби й робочий
              тиск, схему підживлення чи захист рослин під конкретну культуру та сезон.
            </p>
            <p>
              Онлайн-замовлення відправляємо Новою поштою по всій Україні, а для мешканців Бучі й сусідніх громад діє
              безкоштовний самовивіз. На всі покупки діють зрозумілі умови{" "}
              <Link href="/payment-delivery">доставки й оплати</Link> та 14-денного{" "}
              <Link href="/returns">повернення й обміну</Link>.
            </p>
            <Link className="story-link" href="/catalog">Переглянути каталог товарів <ArrowRightIcon /></Link>
          </div>
          <ul className="story-index">
            {ranges.map((range) => (
              <li key={range.slug}>
                <Link href={`/catalog/${range.slug}`}>
                  <strong>{range.title}</strong><span>{range.examples}</span><ArrowRightIcon />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <section className="story-garden info-sheet" aria-labelledby="story-garden-title">
        <div className="story-copy">
          <h2 id="story-garden-title">Автополив і садові роботи на Київщині</h2>
          <p>
            Окрім роздрібного магазину, бригада Poli Valko виконує садові роботи під ключ на приватних і комерційних
            ділянках у Бучі, Ірпені, Гостомелі, Ворзелі, Вишгороді та по Київській області. Робимо{" "}
            <Link href="/services/montazh-avtopolyvu">проєктування і монтаж систем автополиву</Link> на базі
            обладнання Hunter та Irritec, виконуємо{" "}
            <Link href="/services/servis-avtopolyvu">весняний запуск і консервацію поливу на зиму</Link>, створюємо{" "}
            <Link href="/services/landshaftnyi-dyzain">ландшафтний дизайн</Link>, укладаємо рулонні й посівні{" "}
            <Link href="/services/hazony">газони</Link>, висаджуємо дерева й кущі, забезпечуємо сезонний{" "}
            <Link href="/services/dohliad-za-sadom">догляд за садом</Link> і захисну{" "}
            <Link href="/services/obrobka-roslyn">обробку рослин</Link>.
          </p>
        </div>
        <div className="story-garden__links">
          <Link className="btn btn--graphite" href="/services">Усі послуги <ArrowRightIcon /></Link>
          <Link className="story-link" href="/contacts#request">Залишити заявку на розрахунок</Link>
        </div>
      </section>
    </div>
  );
}

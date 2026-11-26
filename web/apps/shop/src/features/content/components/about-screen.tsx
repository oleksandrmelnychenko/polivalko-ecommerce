import Link from "next/link";
import { ArrowRightIcon, PinIcon } from "@polivalko/shared/ui/icons";
import { breadcrumbJsonLd, JsonLd, seoMetadata } from "@/features/seo";
import { Breadcrumbs } from "@/shared/ui/breadcrumbs";

export const metadata = seoMetadata({ title: "Про Полі-Валько", description: "Полі-Валько — магазин товарів для саду й городу. У нас можна придбати садові інструменти, насіння й добрива, замовити озеленення та монтаж системи поливу.", path: "/about" });

const ranges = [
  { slug: "vse-dlia-polyvu", title: "Полив", examples: "Шланги, з’єднувачі, дощувачі" },
  { slug: "vse-dlia-roslyn", title: "Для рослин", examples: "Насіння, ґрунти, добрива" },
  { slug: "ruchnyi-instrument", title: "Ручний інструмент", examples: "Секатори, лопати, граблі" },
  { slug: "vse-dlia-vidpochynku", title: "Для відпочинку", examples: "Садові меблі, грилі, гамаки" },
];

export default function AboutPage() {
  return (
    <div className="container story-page">
      <Breadcrumbs current="Про нас" />
      <JsonLd data={breadcrumbJsonLd([{ name: "Про нас", path: "/about" }])} />
      <div className="story-intro">
        <header className="story-cover garden-print">
          <div className="story-cover__text">
            <h1>Полі-Валько</h1>
            <p>Магазин для тих, хто вирощує овочі, доглядає сад і любить проводити час на подвір’ї.</p>
            <Link href="/contacts#store"><PinIcon /> Де нас знайти</Link>
          </div>
        </header>
        <section className="story-shop info-sheet" aria-labelledby="story-shop-title">
          <div className="story-copy">
            <h2 id="story-shop-title">У нашому магазині</h2>
            <p>Завітайте, щоб оглянути товар і порадитися з продавцем. Онлайн-замовлення надсилаємо Новою поштою по Україні.</p>
            <Link className="story-link" href="/catalog">Переглянути каталог <ArrowRightIcon /></Link>
          </div>
          <ul className="story-index">
            {ranges.map(range => (
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
          <h2 id="story-garden-title">Садові роботи</h2>
          <p>Добираємо дерева й кущі з урахуванням ґрунту та освітлення на ділянці. Закладаємо газони, монтуємо системи поливу й готуємо їх до зими.</p>
        </div>
        <div className="story-garden__links">
          <Link className="btn btn--graphite" href="/services">Усі послуги <ArrowRightIcon /></Link>
          <Link className="story-link" href="/contacts#request">Залишити заявку</Link>
        </div>
      </section>
    </div>
  );
}

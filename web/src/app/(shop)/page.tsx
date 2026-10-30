import Link from "next/link";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";
import { CategoryGrid, CategoryTile } from "@/components/category-cards";
import { HeroSlider, type HeroSlide } from "@/components/hero-slider";
import { ArrowRightIcon, ClockIcon, PhoneIcon, PinIcon, ShieldIcon, StoreIcon, TruckIcon, WalletIcon } from "@/components/icons";
import { ProductTile, ProductTiles, ProductTilesSkeleton } from "@/components/product-card";
import { Rail } from "@/components/rail";
import type { ProductListItem } from "@/lib/api/server";
import { getCategoryTree, getCollections, getContacts, getServiceDirections, searchProducts } from "@/lib/catalog";
import { sized } from "@/lib/images";
import { pagePhotos } from "@/lib/stand-in-photos";

// Фото першого екрана на телефоні лежить під затемненням, тож вистачає 540 px: першим вантажиться саме воно.
const HERO_SIZES = "(max-width: 40rem) 270px, (max-width: 60rem) 100vw, 1600px";

const heroSlides: HeroSlide[] = [
  {
    image: { ...sized(pagePhotos.hero.url, HERO_SIZES, 960), alt: pagePhotos.hero.alt },
    kind: "band",
    kicker: "Магазин у Бучі",
    title: "Усе для саду, городу й дому",
    sub: "Відправимо Новою поштою по всій Україні або підготуємо до самовивозу в Бучі",
    cta: { href: "/catalog", label: "Обрати товари" },
  },
  {
    image: { ...sized(pagePhotos.heroSale.url, HERO_SIZES, 960), alt: pagePhotos.heroSale.alt },
    kind: "panel",
    kicker: "Зараз дешевше",
    title: "Знижки для саду",
    sub: "Полив, інструмент і садова техніка за ціною, нижчою, ніж була",
    cta: { href: "/#offers-title", label: "Дивитися знижки" },
  },
];
const LOOK_SIZES = "(max-width: 60rem) 100vw, 33vw";

/**
 * Головна за референсом (тема Sofani, «Home Lookbook V2»): перший екран, далі три пари
 * «лукбук-секція (фото, вертикальний напис, сітка 3×2) + стрічка зі стрілками й вертикальним заголовком».
 */
export default function HomePage() {
  return (
    <>
      <HeroSlider slides={heroSlides} />

      <Suspense fallback={<LookSkeleton />}>
        <OffersPair />
      </Suspense>
      <Suspense fallback={<LookSkeleton />}>
        <CollectionPair />
      </Suspense>
      <Suspense fallback={<LookSkeleton />}>
        <SectionsPair />
      </Suspense>

      <Perks />

      <Suspense fallback={<LookSkeleton />}>
        <ServicesLook />
      </Suspense>

      <Steps />

      <Suspense fallback={null}>
        <StoreVisit />
      </Suspense>
    </>
  );
}


/** Заголовок секції: великими літерами, підпис і розділювач із кружечком. `side` — вертикальний заголовок стрічки. */
function Heading({ id, title, sub, side }: { id: string; title: string; sub: string; side?: "left" | "right" }) {
  return (
    <div className={side ? `heading heading--side heading--${side}` : "heading"}>
      <h2 id={id}>{title}</h2>
      <p>{sub}</p>
      {!side && <span className="heading__rule" aria-hidden="true" />}
    </div>
  );
}

/** Лукбук-секція: фото до краю екрана, вертикальний напис-«водяний знак» і заголовок із сіткою 3×2. */
function Look({ id, title, sub, ghost, photo, reverse, children }: { id: string; title: string; sub: string; ghost: string; photo?: { url: string; alt: string }; reverse?: boolean; children: ReactNode }) {
  return (
    <section className={reverse ? "look look--reverse" : "look"} aria-labelledby={id}>
      <figure className="look__photo">{photo && <img {...sized(photo.url, LOOK_SIZES, 960)} alt={photo.alt} width={960} height={1280} loading="lazy" fetchPriority="low" decoding="async" />}</figure>
      <p className={reverse ? "look__ghost look__ghost--down" : "look__ghost"} aria-hidden="true">
        {ghost}
      </p>
      <div className="look__content">
        <Heading id={id} title={title} sub={sub} />
        {children}
      </div>
    </section>
  );
}

/** Стрічка: подвійні лінії, вертикальний заголовок збоку, плитки зі стрілками. */
function Strip({ id, title, sub, side, children }: { id: string; title: string; sub: string; side: "left" | "right"; children: ReactNode }) {
  return (
    <section className={`strip strip--${side}`} aria-labelledby={id}>
      <div className="container strip__inner">
        <Heading id={id} title={title} sub={sub} side={side} />
        <Rail label={title}>{children}</Rail>
      </div>
    </section>
  );
}

function LookSkeleton() {
  return (
    <div className="look">
      <div className="look__photo skeleton" />
      <span />
      <div className="look__content">
        <ProductTilesSkeleton count={6} />
      </div>
    </div>
  );
}

function RailTiles({ products }: { products: ProductListItem[] }) {
  return (
    <ul className="tiles tiles--rail">
      {products.map((p) => (
        <ProductTile key={p.id} product={p} look />
      ))}
    </ul>
  );
}

/** Актуальні пропозиції (розділ 3 ТЗ): товари, для яких облік підтверджує стару ціну; без них — товари в наявності. */
async function OffersPair() {
  await connection();
  const sale = await searchProducts({ onSale: true, inStock: true, sort: "price_asc", pageSize: 12 });
  const items = sale?.items.length ? sale.items : ((await searchProducts({ inStock: true, pageSize: 12 }))?.items ?? []);
  const photo = pagePhotos.offers;
  return (
    <>
      <Look id="offers-title" title="Знижки" sub="Ціна нижча, ніж була" ghost="Для вашого саду" photo={photo}>
        <ProductTiles products={items.slice(0, 6)} columns={3} look />
      </Look>
      <Strip id="offers-strip-title" title="Знижки" sub="Ціна нижча, ніж була" side="left">
        <RailTiles products={items.length > 6 ? [...items.slice(6), ...items.slice(0, 6)] : items} />
      </Strip>
    </>
  );
}

/** Редакційна добірка з адмінки (розділ 9 ТЗ): «Рекомендовані товари». */
async function CollectionPair() {
  await connection();
  const collection = (await getCollections()).find((c) => c.items.length > 0);
  if (!collection) return null;
  return (
    <>
      <Look id="collection-title" title={collection.title} sub="Радимо зараз" ghost="Для вашого дому" photo={pagePhotos.collection} reverse>
        <ProductTiles products={collection.items.slice(0, 6)} columns={3} look />
      </Look>
      <Strip id="collection-strip-title" title={collection.title} sub="Радимо зараз" side="right">
        <RailTiles products={collection.items} />
      </Strip>
    </>
  );
}

/** Розділи каталогу Navkolo (розділ 4 ТЗ): шість у сітці, усі — у стрічці. */
async function SectionsPair() {
  await connection();
  const categories = await getCategoryTree();
  const photo = pagePhotos.sections;
  return (
    <>
      <Look id="sections-title" title="Розділи каталогу" sub="Усе для дому, саду й городу" ghost="Для вашого городу" photo={photo}>
        <CategoryGrid categories={categories.slice(0, 6)} columns={3} look />
      </Look>
      <Strip id="sections-strip-title" title="Розділи каталогу" sub="Від лійки до газонокосарки" side="left">
        <ul className="tiles tiles--rail">
          {categories.map((c) => (
            <CategoryTile key={c.id} category={c} look />
          ))}
        </ul>
      </Strip>
    </>
  );
}

/** Рядок переваг: доставка, самовивіз, оплата, перевірка цін. */
function Perks() {
  const perks = [
    { icon: <TruckIcon />, title: "Доставка по Україні", text: "У відділення, поштомат або кур'єром. Вартість — за тарифами Нової пошти" },
    { icon: <StoreIcon />, title: "Самовивіз у Бучі", text: "Безкоштовно. Приїжджайте, щойно менеджер підтвердить, що замовлення зібране" },
    { icon: <WalletIcon />, title: "Оплата як зручно", text: "Карткою онлайн, післяплатою у відділенні або в магазині" },
    { icon: <ShieldIcon />, title: "Ціна без сюрпризів", text: "Перед підтвердженням звіряємо ціну й залишок зі складом магазину" },
  ];
  return (
    <section className="perks" aria-label="Доставка, самовивіз і оплата">
      <div className="container">
        <ul className="perks__list">
          {perks.map((p) => (
            <li key={p.title}>
              {p.icon}
              <h3>{p.title}</h3>
              <p>{p.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Короткий блок послуг (розділ 3 ТЗ) як лукбук-секція: фото праворуч, сім напрямків нумерованим списком. */
async function ServicesLook() {
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

/** Як замовити: три кроки з великими номерами. */
function Steps() {
  const steps = [
    { title: "Оберіть товари", text: "Шукайте за назвою чи артикулом або гортайте розділи: полив, інструмент, техніка, усе для рослин." },
    { title: "Оформіть без реєстрації", text: "Потрібні лише ім'я й телефон. Ціну й наявність ми ще раз звіримо перед підтвердженням." },
    { title: "Отримайте замовлення", text: "Новою поштою у відділенні, поштоматі чи кур'єром — або заберіть самі в магазині в Бучі." },
  ];
  return (
    <section className="steps" aria-labelledby="steps-title">
      <div className="container">
        <Heading id="steps-title" title="Як замовити" sub="Три кроки до покупки" />
        <ol className="steps__list">
          {steps.map((s) => (
            <li key={s.title}>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/** Магазин у Бучі: адреса, графік, телефон і маршрут з адмінки; поки їх немає — видно, що дані уточнюються. */
async function StoreVisit() {
  await connection();
  const contacts = await getContacts();
  return (
    <section className="visit" aria-labelledby="visit-title">
      <div className="container visit__inner">
        <div className="visit__copy">
          <Heading id="visit-title" title="Магазин у Бучі" sub="Подивіться товар наживо й заберіть замовлення" />
          <ul className="visit__facts">
            <li>
              <PinIcon />
              <span>{contacts?.address ?? <span className="fill">Буча, адреса уточнюється</span>}</span>
            </li>
            <li>
              <ClockIcon />
              <span>{contacts?.schedule ?? <span className="fill">графік уточнюється</span>}</span>
            </li>
            {contacts?.storePhone && (
              <li>
                <PhoneIcon />
                <a href={`tel:${contacts.storePhone.replace(/[^\d+]/g, "")}`}>{contacts.storePhone}</a>
              </li>
            )}
          </ul>
          <p className="visit__actions">
            <Link href="/contacts" className="btn">
              Контакти й маршрут
              <ArrowRightIcon />
            </Link>
            <Link href="/payment-delivery" className="btn btn--outline">
              Доставка й оплата
            </Link>
          </p>
        </div>
        <figure className="visit__photo">
          <img {...sized(pagePhotos.store.url, "(max-width: 60rem) 100vw, 600px", 960)} alt={pagePhotos.store.alt} width={960} height={720} loading="lazy" fetchPriority="low" decoding="async" />
        </figure>
      </div>
    </section>
  );
}

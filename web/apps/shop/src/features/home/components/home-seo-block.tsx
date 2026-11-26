import Link from "next/link";

export function HomeSeoBlock() {
  return (
    <section className="container home-section" aria-labelledby="home-seo-title">
      <div className="home-section__head">
        <div className="home-section__titles">
          <h2 id="home-seo-title">Poli Valko — усе для поливу, саду та городу</h2>
          <p>
            Офлайн-магазин у Бучі (ТК «Варшавський»), доставка по Україні та професійні садові роботи на Київщині.
          </p>
        </div>
      </div>
      <div className="store-visit__pickup">
        <div>
          <h3>Асортимент каталогу та доставка по Україні</h3>
          <p>
            У каталозі Poli Valko зібрано понад 4 900 товарів для догляду за ділянкою:{" "}
            <Link href="/catalog/vse-dlia-polyvu">системи поливу</Link> (шланги Cellfast і Gardena,{" "}
            <Link href="/catalog/krapelnyi-polyv">крапельний полив</Link>, обладнання Hunter та Irritec для
            автополиву, дощувачі й фітинги),{" "}
            <Link href="/catalog/vse-dlia-roslyn">товари для рослин</Link> —{" "}
            <Link href="/catalog/nasinnia">насіння SeedEra</Link>,{" "}
            <Link href="/catalog/dobryva">добрива</Link>, ґрунтосуміші й засоби захисту, а також{" "}
            <Link href="/catalog/ruchnyi-instrument">ручний інструмент</Link> Fiskars і Truper,{" "}
            <Link href="/catalog/tekhnika-dlia-sadu-ta-horodu">садова техніка</Link> та матеріали для{" "}
            <Link href="/catalog/landshaftnyi-dyzain">ландшафтного дизайну</Link>. Повний перелік виробників
            представлено у розділі <Link href="/brands">бренди</Link>. Відправляємо замовлення Новою поштою по всій
            Україні або видаємо безкоштовно в магазині у Бучі.
          </p>
        </div>
        <div>
          <h3>Автополив і садові послуги в Бучі та Київській області</h3>
          <p>
            Команда фахівців Poli Valko виконує{" "}
            <Link href="/services">комплексні послуги для саду</Link> в Бучі, Ірпені, Гостомелі, Ворзелі,
            Вишгороді та по Київській області. Пропонуємо{" "}
            <Link href="/services/montazh-avtopolyvu">проєктування і монтаж автополиву</Link> під ключ,{" "}
            <Link href="/services/servis-avtopolyvu">весняний запуск і консервацію систем</Link>, укладання
            рулонних і посівних <Link href="/services/hazony">газонів</Link>,{" "}
            <Link href="/services/landshaftnyi-dyzain">ландшафтний дизайн</Link>, висадку рослин і{" "}
            <Link href="/services/dohliad-za-sadom">сезонний догляд за садом</Link>. Дізнайтеся більше{" "}
            <Link href="/about">про наш магазин</Link> або перегляньте{" "}
            <Link href="/contacts">контакти й графік роботи</Link>.
          </p>
        </div>
      </div>
    </section>
  );
}

import { Breadcrumbs } from "@/shared/ui/breadcrumbs";
import Form from "next/form";
import Link from "next/link";
import { SearchIcon } from "@polivalko/shared/ui/icons";

export function NotFoundContent() {
  return (
    <div className="container not-found">
      <Breadcrumbs current="Сторінку не знайдено" />
      <section className="not-found__content" aria-labelledby="not-found-title">
        <div className="not-found__code">
          <span>404</span>
          <img src="/mascot/poli-valka-mark.webp" width="112" height="200" alt="" />
        </div>
        <h1 id="not-found-title">Сторінку не знайдено</h1>
        <p>Спробуйте знайти товар за назвою чи артикулом або перейдіть до каталогу.</p>
        <Form action="/search" role="search" aria-label="Пошук за назвою або артикулом" className="not-found__search">
          <SearchIcon />
          <label htmlFor="not-found-search" className="visually-hidden">Назва товару або артикул</label>
          <input id="not-found-search" name="q" type="search" placeholder="Товар або артикул" autoComplete="off" spellCheck={false} enterKeyHint="search" required />
          <button type="submit" className="btn btn--graphite">Знайти</button>
        </Form>
        <div className="not-found__links">
          <Link href="/catalog" className="btn btn--outline">До каталогу</Link>
          <Link href="/" className="link">На головну</Link>
        </div>
      </section>
    </div>
  );
}

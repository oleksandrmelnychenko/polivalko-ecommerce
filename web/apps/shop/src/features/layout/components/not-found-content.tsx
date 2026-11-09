import Form from "next/form";
import Link from "next/link";
import { SearchIcon } from "@polivalko/shared/ui/icons";

export function NotFoundContent() {
  return (
    <div className="container not-found">
      <h1>Сторінку не знайдено</h1>
      <p className="lead">Можливо, товар більше не продається або адреса змінилася. Спробуйте знайти його за назвою чи артикулом.</p>
      <Form action="/search" role="search" className="search not-found__search">
        <label htmlFor="not-found-search" className="visually-hidden">
          Пошук за назвою або артикулом
        </label>
        <SearchIcon />
        <input id="not-found-search" name="q" type="search" placeholder="Назва товару або артикул…" autoComplete="off" spellCheck={false} enterKeyHint="search" />
        <button type="submit" className="btn">
          Знайти
        </button>
      </Form>
      <p className="not-found__links">
        <Link href="/catalog" className="btn btn--outline">
          Перейти до каталогу
        </Link>
        <Link href="/" className="link">
          На головну
        </Link>
      </p>
    </div>
  );
}

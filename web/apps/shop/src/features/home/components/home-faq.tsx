import Link from "next/link";
import { getContacts } from "@/features/content/server";
import { directionsUrl } from "@/shared/lib/directions-url";

export async function HomeFaq() {
  const contacts = await getContacts().catch(() => null);
  const route = directionsUrl(contacts?.mapUrl, contacts?.address);
  return <section className="container home-faq" aria-labelledby="home-faq-title">
    <h2 id="home-faq-title">Часті запитання</h2>
    <div className="home-faq__list">
      <div>
        <details><summary>Як знайти потрібний товар?</summary><p>Відкрийте потрібний розділ каталогу або введіть назву чи артикул у пошуку. Використовуйте фільтри для пошуку та порівняння характеристик товарів одного типу.</p></details>
        <details><summary>Чи потрібна реєстрація для замовлення?</summary><p>Замовлення можна оформити без реєстрації. У кабінеті доступні історія замовлень, обрані товари та збережені адреси доставки.</p></details>
        <details><summary>Як дізнатися про доставку й оплату?</summary><p>Доступні способи та умови наведено на сторінці <Link href="/payment-delivery">«Доставка й оплата»</Link>. Під час оформлення оберіть зручний варіант.</p></details>
      </div>
      <div>
        <details>
          <summary>Де розташований магазин?</summary>
          <div className="home-faq__location">
            {contacts?.address && <p>{contacts.address}</p>}
            {contacts?.schedule && <p>{contacts.schedule}</p>}
            {route && <a className="link" href={route} target="_blank" rel="noopener noreferrer">Прокласти маршрут</a>}
            <Link className="link" href="/contacts">Усі контакти</Link>
          </div>
        </details>
        <details><summary>Як повернути або обміняти товар?</summary><p>Умови й порядок звернення описано на сторінці <Link href="/returns">«Повернення й обмін»</Link>.</p></details>
        <details><summary>Як замовити послугу для саду?</summary><p>Перегляньте <Link href="/services">перелік послуг</Link> і залиште заявку. Менеджер зв’яжеться з вами в робочий час.</p></details>
      </div>
    </div>
  </section>;
}

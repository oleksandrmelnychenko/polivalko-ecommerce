import Link from "next/link";
import { FaqJsonLd, getContacts } from "@/features/content/server";
import { directionsUrl } from "@/shared/lib/directions-url";

const DEFAULT_STORE_ADDRESS = "м. Буча, вул. Депутатська, 1-В, ТК «Варшавський», фасадний ряд, приміщення №8-12";
const DEFAULT_STORE_SCHEDULE = "Пн–Сб 09:00–18:00, Нд 10:00–17:00";

export async function HomeFaq() {
  const contacts = await getContacts().catch(() => null);
  const route = directionsUrl(contacts?.mapUrl, contacts?.address);
  const address = contacts?.address?.trim() || DEFAULT_STORE_ADDRESS;
  const schedule = contacts?.schedule?.trim() || DEFAULT_STORE_SCHEDULE;
  const faqItems = [
    {
      question: "Як знайти потрібний товар?",
      answer: "Відкрийте потрібний розділ каталогу або введіть назву чи артикул у пошуку. Використовуйте фільтри для пошуку та порівняння характеристик товарів одного типу.",
    },
    {
      question: "Чи потрібна реєстрація для замовлення?",
      answer: "Замовлення можна оформити без реєстрації. У кабінеті доступні історія замовлень, обрані товари та збережені адреси доставки.",
    },
    {
      question: "Як дізнатися про доставку й оплату?",
      answer: "Доступні способи та умови наведено на сторінці «Доставка й оплата». Під час оформлення оберіть зручний варіант.",
    },
    {
      question: "Де розташований магазин?",
      answer: `${address}. Графік роботи: ${schedule}.`,
    },
    {
      question: "Як повернути або обміняти товар?",
      answer: "Умови й порядок звернення описано на сторінці «Повернення й обмін».",
    },
    {
      question: "Як замовити послугу для саду?",
      answer: "Перегляньте перелік послуг і залиште заявку. Менеджер зв’яжеться з вами в робочий час.",
    },
  ];
  return <section className="container home-faq" aria-labelledby="home-faq-title">
    <FaqJsonLd items={faqItems} />
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
            <p>{address}</p>
            <p>{schedule}</p>
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

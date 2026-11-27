import Link from "next/link";
import { ChevronDownIcon } from "@polivalko/shared/ui/icons";
import { FaqJsonLd } from "@/features/content/server";

const faqItems = [
  {
    question: "Чи можна замовити без реєстрації?",
    answer: "Так. Додайте товари до кошика й під час оформлення вкажіть контактні дані.",
  },
  {
    question: "Як отримати й оплатити замовлення?",
    answer: "Під час оформлення оберіть спосіб отримання. На наступному кроці ви побачите доступні для нього варіанти оплати.",
    link: { href: "/payment-delivery", label: "Умови доставки й оплати" },
  },
  {
    question: "Коли можна забрати покупку з магазину?",
    answer: "Дочекайтеся повідомлення, що замовлення готове. На касі назвіть номер замовлення.",
  },
  {
    question: "Як повернути або обміняти товар?",
    answer: "Зв’яжіться з магазином і назвіть номер замовлення та товар, який хочете повернути або обміняти.",
    link: { href: "/returns", label: "Умови повернення й обміну" },
  },
];

export function HomeFaq() {
  return (
    <section className="container home-faq" aria-labelledby="home-faq-title">
      <FaqJsonLd items={faqItems} />
      <div className="home-faq__inner">
        <header>
          <h2 id="home-faq-title">Часті запитання</h2>
          <Link className="link" href="/contacts">Зв’язатися з магазином</Link>
        </header>
        <div className="home-faq__list">
          {faqItems.map(({ question, answer, link }) => (
            <details key={question} name="home-faq">
              <summary>{question}<span aria-hidden="true"><ChevronDownIcon /></span></summary>
              <div className="home-faq__answer">
                <p>{answer}</p>
                {link && <Link className="link" href={link.href}>{link.label}</Link>}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

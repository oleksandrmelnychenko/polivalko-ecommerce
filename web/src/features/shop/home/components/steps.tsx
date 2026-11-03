import { Heading } from "./heading";

export function Steps() {
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

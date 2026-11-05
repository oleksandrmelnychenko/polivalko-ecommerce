import type { CSSProperties } from "react";
import type { TextItem } from "@/features/content/server";
import { Heading } from "./heading";

const DEFAULT_STEPS: TextItem[] = [
  { title: "Оберіть товари", text: "Шукайте за назвою чи артикулом або гортайте розділи: полив, інструмент, техніка, усе для рослин." },
  { title: "Оформіть без реєстрації", text: "Потрібні лише ім'я й телефон. Ціну й наявність ми ще раз звіримо перед підтвердженням." },
  { title: "Отримайте замовлення", text: "Новою поштою у відділенні, поштоматі чи кур'єром — або заберіть самі в магазині в Бучі." },
];

export function Steps({ items }: { items?: TextItem[] | null }) {
  const given = items?.filter((s) => s.title?.trim()) ?? [];
  const steps = given.length ? given : DEFAULT_STEPS;
  return (
    <section className="steps" aria-labelledby="steps-title">
      <div className="container">
        <Heading id="steps-title" title="Як замовити" sub={steps.length === 3 ? "Три кроки до покупки" : "Від вибору до отримання"} />
        <ol className="steps__list" style={{ "--steps": Math.min(steps.length, 3) } as CSSProperties}>
          {steps.map((s, i) => (
            <li key={`${i}-${s.title}`}>
              <h3>{s.title}</h3>
              {s.text && <p>{s.text}</p>}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

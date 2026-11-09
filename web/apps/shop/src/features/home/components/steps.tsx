import type { CSSProperties } from "react";
import type { TextItem } from "@/features/content/server";
import { Heading } from "./heading";

const DEFAULT_STEPS: TextItem[] = [
  { title: "Оберіть товари", text: "Знайдіть товар за назвою чи артикулом або відкрийте потрібний розділ каталогу." },
  { title: "Оформіть без реєстрації", text: "Достатньо імені й телефону. Ціну й залишок звіримо зі складом перед підтвердженням." },
  { title: "Отримайте замовлення", text: "Новою поштою в будь-якому місті України. Або заберіть самі з магазину, це безкоштовно." },
];

export function Steps({ items }: { items?: TextItem[] | null }) {
  const given = items?.filter((s) => s.title?.trim()) ?? [];
  const steps = given.length ? given : DEFAULT_STEPS;
  return (
    <section className="steps" aria-labelledby="steps-title">
      <div className="container">
        <Heading id="steps-title" title="Як замовити" />
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

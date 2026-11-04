import type { Problem } from "@polivalko/shared/api/problem";

export type Status = { kind: "ok" | "error" | "info"; title: string; text?: string } | null;

export function failureStatus(response: Response, error: unknown): Status {
  const problem = error as Problem | undefined;
  if (response.status === 400 && problem?.errors) return { kind: "error", title: "Перевірте поля, позначені нижче." };
  if (response.status === 429) return { kind: "error", title: "Забагато спроб", text: "Зачекайте кілька хвилин і спробуйте знову." };
  if (response.status === 503) return { kind: "error", title: "Сервіс тимчасово недоступний", text: "Спробуйте трохи пізніше." };
  return { kind: "error", title: problem?.title ?? "Не вдалося зберегти", text: problem?.title ? problem.detail : "Спробуйте ще раз." };
}

export const offline: Status = { kind: "error", title: "Немає зв'язку з сервером", text: "Перевірте інтернет і спробуйте ще раз." };

export function text(form: FormData, name: string): string {
  return String(form.get(name) ?? "").trim();
}

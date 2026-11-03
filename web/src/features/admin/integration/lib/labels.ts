import type { components } from "@/shared/api/schema";
import type { Job } from "./types";

type RunStatus = components["schemas"]["SyncRunStatus"];

export const navkoloModeLabel: Record<string, string> = {
  Disabled: "вимкнено: ціни й залишки приходять з імпорту файлів",
  Stub: "тестова заглушка: обмін з Navkolo імітується",
};

export const FILE_IMPORT_JOB = "navkolo.import";

export const waitsForWorker = (j: Job) =>
  j.runRequestedAt !== null && (j.lastAttemptAt === null || Date.parse(j.runRequestedAt) > Date.parse(j.lastAttemptAt));

export const novaPoshtaModeLabel: Record<string, string> = {
  demo: "демо: ключ API не налаштовано, вітрина показує демонстраційні відділення",
  api: "API Нової пошти: вітрина бачить локальну копію довідника",
};

export const messageTypeLabel: Record<string, string> = {
  "ordering.order-placed": "Сповіщення про нове замовлення",
  "ordering.export-requested": "Передача замовлення в Navkolo",
  "ordering.payment-succeeded": "Обробка успішної оплати",
  "ordering.refund-requested": "Повернення коштів",
  "ordering.fiscal-receipt-requested": "Фіскальний чек",
  "content.service-request-submitted": "Сповіщення про заявку на послугу",
  "integration.alert": "Сповіщення про збій інтеграції",
};

export const runStatusLabel: Record<RunStatus, string> = {
  running: "Виконується",
  succeeded: "Успішно",
  partiallySucceeded: "Частково, з помилками",
  failed: "Не вдалося",
};

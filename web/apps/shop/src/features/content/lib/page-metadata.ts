import type { Metadata } from "next";
import { connection } from "next/server";
import { seoMetadata } from "@/features/seo";
import { getPage } from "../api/server";

const PAGE_SEO_FALLBACKS: Record<string, { title: string; description: string }> = {
  "payment-delivery": {
    title: "Доставка Новою поштою, оплата й самовивіз",
    description:
      "Умови доставки й оплати в Poli Valko: Нова пошта по всій Україні, безкоштовний самовивіз у Бучі (ТК «Варшавський»), оплата карткою чи післяплатою.",
  },
  returns: {
    title: "Повернення й обмін товарів протягом 14 днів",
    description:
      "Умови повернення та обміну товарів у магазині Poli Valko протягом 14 днів за законодавством України. Як звернутися до магазину та повернути кошти.",
  },
  offer: {
    title: "Публічна оферта та умови купівлі в магазині",
    description:
      "Договір публічної оферти інтернет-магазину Poli Valko (ФОП Валко Віталій): порядок оформлення, оплати, доставки та повернення замовлень в Україні.",
  },
  privacy: {
    title: "Політика конфіденційності й захисту даних",
    description:
      "Політика конфіденційності інтернет-магазину Poli Valko: як ми обробляємо, зберігаємо й захищаємо персональні дані покупців відповідно до закону.",
  },
};

export function resolvePageSeo(
  slug: string,
  fallbackTitle: string,
  page?: { seoTitle?: string | null; title?: string | null; seoDescription?: string | null; lead?: string | null } | null
): { title: string; description?: string } {
  const defaults = PAGE_SEO_FALLBACKS[slug];
  const cmsTitle = page?.seoTitle?.trim() || "";
  const title = cmsTitle.length >= 32 ? cmsTitle : defaults?.title || page?.title?.trim() || fallbackTitle;

  const cmsDesc = page?.seoDescription?.trim() || "";
  const description =
    cmsDesc.length >= 110 && cmsDesc.length <= 160
      ? cmsDesc
      : defaults?.description || cmsDesc || page?.lead?.trim() || undefined;

  return { title, description };
}

export async function pageMetadata(slug: string, fallbackTitle: string): Promise<Metadata> {
  await connection();
  const page = await getPage(slug).catch(() => null);
  const { title, description } = resolvePageSeo(slug, fallbackTitle, page);
  return seoMetadata({
    title,
    description,
    path: `/${slug}`,
  });
}

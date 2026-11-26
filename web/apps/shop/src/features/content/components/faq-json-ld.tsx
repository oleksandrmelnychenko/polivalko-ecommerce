import { faqPageJsonLd, JsonLd, type FaqItem } from "@/features/seo";

export function FaqJsonLd({ items }: { items: ReadonlyArray<FaqItem> }) {
  const valid = items.filter((item) => item.question.trim().length > 0 && item.answer.trim().length > 0);
  if (valid.length === 0) return null;
  return <JsonLd data={faqPageJsonLd(valid)} />;
}

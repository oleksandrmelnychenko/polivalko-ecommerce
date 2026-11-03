import { plainText } from "@/shared/lib/format";

export function descriptionText(html: string | null | undefined): string {
  return plainText(html).join(" ").slice(0, 160);
}

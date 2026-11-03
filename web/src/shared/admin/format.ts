import { formatDateTime } from "@/shared/lib/format";

export function when(iso: string | null | undefined): string {
  return iso ? formatDateTime(iso) : "—";
}

import { revalidateTag } from "next/cache";

/**
 * Скидання кешу каталогу за тегами. Викликає Worker внутрішньою мережею після синхронізації
 * з Navkolo або змін в адмінці. Ззовні шлях /internal/* закритий у Caddy.
 */
export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret || request.headers.get("x-revalidate-secret") !== secret) {
    return new Response(null, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { tags?: unknown } | null;
  const tags = Array.isArray(body?.tags) ? body.tags.filter((t): t is string => typeof t === "string") : [];
  for (const tag of tags) {
    revalidateTag(tag, "max");
  }

  return Response.json({ revalidated: tags });
}

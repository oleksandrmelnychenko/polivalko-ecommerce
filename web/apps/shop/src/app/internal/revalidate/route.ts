import { createHash, timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";

const digest = (value: string) => createHash("sha256").update(value).digest();
const catalogTags = new Set(["catalog", "categories", "products", "collections", "redirects"]);

export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  const supplied = request.headers.get("x-revalidate-secret");
  if (!secret || !supplied || !timingSafeEqual(digest(supplied), digest(secret))) {
    return new Response(null, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { tags?: unknown } | null;
  if (!Array.isArray(body?.tags) || body.tags.length > 128 ||
      !body.tags.every((tag): tag is string => typeof tag === "string" && tag.length > 0 && tag.length <= 256)) {
    return new Response(null, { status: 400 });
  }
  const tags = [...new Set(body.tags)];
  for (const tag of tags) {
    revalidateTag(tag, catalogTags.has(tag) ? { expire: 0 } : "max");
  }

  return Response.json({ revalidated: tags });
}

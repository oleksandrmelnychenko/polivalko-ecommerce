import { revalidateTag } from "next/cache";

const catalogTags = new Set(["catalog", "categories", "products", "collections", "redirects"]);

export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret || request.headers.get("x-revalidate-secret") !== secret) {
    return new Response(null, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { tags?: unknown } | null;
  const tags = Array.isArray(body?.tags) ? body.tags.filter((t): t is string => typeof t === "string") : [];
  for (const tag of tags) {
    revalidateTag(tag, catalogTags.has(tag) ? { expire: 0 } : "max");
  }

  return Response.json({ revalidated: tags });
}

import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getBestsellers } from "@/features/catalog/server";

export async function GET() {
  await connection();
  const top = await getBestsellers(1).catch(() => null);
  const slug = top?.items[0]?.product.slug;
  redirect(slug ? `/product/${slug}` : "/catalog");
}

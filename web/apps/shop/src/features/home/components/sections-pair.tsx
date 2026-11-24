import { connection } from "next/server";
import { CategoryCards } from "@/features/catalog";
import { getCategoryTree } from "@/features/catalog/server";
import { HomeSection } from "./home-section";

export async function SectionsPair() {
  await connection();
  const categories = await getCategoryTree().catch(() => []);
  if (categories.length === 0) return null;
  return (
    <HomeSection id="sections-title" title="Категорії" more={{ href: "/catalog", label: "Увесь каталог" }}>
      <CategoryCards categories={categories} nested />
    </HomeSection>
  );
}

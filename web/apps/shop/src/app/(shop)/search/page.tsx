import type { Metadata } from "next";
import { SearchScreen } from "@/features/search/server";

export const metadata: Metadata = {
  title: "Пошук",
  robots: { index: false, follow: true },
};

export default function SearchPage(props: PageProps<"/search">) {
  return <SearchScreen {...props} />;
}

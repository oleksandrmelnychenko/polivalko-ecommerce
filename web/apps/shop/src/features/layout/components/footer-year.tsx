import { cacheLife } from "next/cache";
import { currentYear } from "../lib/current-year";

async function cachedYear() {
  "use cache";
  cacheLife("days");
  return currentYear();
}

export async function FooterYear() {
  return <>{await cachedYear()} </>;
}

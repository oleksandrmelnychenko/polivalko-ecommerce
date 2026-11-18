import { connection } from "next/server";
import { currentYear } from "../lib/current-year";

export async function FooterYear() {
  await connection();
  return <>{currentYear()} </>;
}

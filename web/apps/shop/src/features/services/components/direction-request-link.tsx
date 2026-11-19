import Link from "next/link";

export function DirectionRequestLink({ code }: { code: string }) {
  return <Link className="services-link" href={`/contacts?direction=${encodeURIComponent(code)}#request`}>Залишити заявку</Link>;
}

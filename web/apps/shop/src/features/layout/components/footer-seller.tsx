import { connection } from "next/server";
import { getSeller } from "@/features/content/server";

export async function FooterSeller() {
  await connection();
  const seller = await getSeller().catch(() => null);
  if (!seller?.name?.trim()) return null;
  return (
    <details className="footer__seller">
      <summary>Реквізити продавця</summary>
      <p>{seller.name}</p>
      {seller.taxId && (
        <p>Код: <span translate="no">{seller.taxId}</span></p>
      )}
      {seller.address && (
        <p>Адреса: {seller.address}</p>
      )}
    </details>
  );
}

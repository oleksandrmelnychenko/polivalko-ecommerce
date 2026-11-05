import { connection } from "next/server";
import { getSeller } from "@/features/content/server";

export async function FooterSeller() {
  await connection();
  const seller = await getSeller().catch(() => null);
  if (!seller?.name?.trim()) return null;
  return (
    <p className="footer__seller">
      {seller.name}
      {seller.taxId && (
        <>
          <br />
          Код: <span translate="no">{seller.taxId}</span>
        </>
      )}
      {seller.address && (
        <>
          <br />
          Адреса: {seller.address}
        </>
      )}
    </p>
  );
}

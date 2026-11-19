import { connection } from "next/server";
import { getSeller } from "../api/server";

export async function SellerDetails() {
  await connection();
  const seller = await getSeller().catch(() => null);
  if (!seller) return null;
  const rows = [
    { label: "Продавець", value: seller.name },
    { label: "Код ЄДРПОУ або РНОКПП", value: seller.taxId },
    { label: "Адреса", value: seller.address },
    { label: "IBAN", value: seller.iban },
    { label: "Email", value: seller.email },
    { label: "Телефон", value: seller.phone },
  ].filter((row): row is { label: string; value: string } => Boolean(row.value?.trim()));
  if (rows.length === 0) return null;

  return (
    <section className="doc__section doc__seller" aria-labelledby="seller-title">
      <h2 id="seller-title">Реквізити продавця</h2>
      <dl className="doc__facts">
        {rows.map((row) => (
          <div key={row.label}>
            <dt>{row.label}</dt>
            <dd translate="no">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

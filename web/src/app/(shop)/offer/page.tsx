import type { Metadata } from "next";
import { InfoPage } from "@/components/info-page";
import { getSeller } from "@/lib/catalog";

export const metadata: Metadata = { title: "Публічна оферта", alternates: { canonical: "/offer" } };

export default function OfferPage() {
  return (
    <InfoPage slug="offer">
      <SellerDetails />
    </InfoPage>
  );
}

/** Реквізити продавця з налаштувань API: той самий продавець потрапляє в замовлення (розділ 5 ТЗ). */
async function SellerDetails() {
  const seller = await getSeller();
  if (!seller) return null;
  return (
    <section className="prose" aria-labelledby="seller-title" style={{ marginTop: "var(--space-xl)" }}>
      <h2 id="seller-title">Реквізити продавця</h2>
      <dl className="facts">
        <dt>Продавець</dt>
        <dd>{seller.name}</dd>
        {seller.taxId && (
          <>
            <dt>Код</dt>
            <dd>
              <span className="code">{seller.taxId}</span>
            </dd>
          </>
        )}
        {seller.address && (
          <>
            <dt>Адреса</dt>
            <dd>{seller.address}</dd>
          </>
        )}
      </dl>
    </section>
  );
}

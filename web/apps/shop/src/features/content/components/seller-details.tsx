import { getSeller } from "../api/server";

export async function SellerDetails() {
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

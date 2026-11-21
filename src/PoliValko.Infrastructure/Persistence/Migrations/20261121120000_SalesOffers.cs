using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace PoliValko.Infrastructure.Persistence.Migrations;

[DbContext(typeof(PoliValkoDbContext))]
[Migration("20261121120000_SalesOffers")]
public sealed class SalesOffers : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        CREATE TABLE accounting.sales_offers (
            id uuid PRIMARY KEY, partner_id uuid NOT NULL REFERENCES accounting.partners(id),
            day date NOT NULL, focus text NOT NULL CHECK(focus IN ('general','irrigation')),
            body text NOT NULL CHECK(length(body) BETWEEN 1 AND 8000)
        );
        CREATE INDEX sales_offers_day ON accounting.sales_offers(day,partner_id);
        CREATE TABLE accounting.sales_offer_shipments (
            document_id uuid PRIMARY KEY REFERENCES accounting.documents(id),
            offer_id uuid NOT NULL REFERENCES accounting.sales_offers(id)
        );
        CREATE INDEX sales_offer_shipments_offer ON accounting.sales_offer_shipments(offer_id);
        CREATE VIEW accounting.offer_invoices AS
            SELECT id,day,number,partner_id,amount::numeric AS amount FROM accounting.document_register
            WHERE entity_type='invoice' AND kind='out' AND status IN ('active','posted')
              AND currency IN ('UAH','980') AND amount::numeric > 0 AND partner_id IS NOT NULL;
        """);

    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        DROP VIEW accounting.offer_invoices;
        DROP TABLE accounting.sales_offer_shipments,accounting.sales_offers;
        """);
}

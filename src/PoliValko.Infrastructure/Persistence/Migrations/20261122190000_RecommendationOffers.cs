using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace PoliValko.Infrastructure.Persistence.Migrations;

[DbContext(typeof(PoliValkoDbContext))]
[Migration("20261122190000_RecommendationOffers")]
public sealed class RecommendationOffers : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        CREATE TABLE accounting.recommendation_offers (
            id uuid PRIMARY KEY,
            partner_id uuid NOT NULL REFERENCES accounting.partners(id),
            product_id uuid NOT NULL REFERENCES catalog.products(id),
            last_purchase date NOT NULL,
            quantity numeric(15,3) NOT NULL CHECK (quantity > 0),
            unit text NOT NULL, price numeric NOT NULL CHECK (price > 0),
            status text NOT NULL CHECK (status IN ('offered','reserved','declined','released')),
            offered_at timestamptz NOT NULL DEFAULT now(), changed_at timestamptz NOT NULL DEFAULT now(),
            UNIQUE (partner_id,product_id,last_purchase)
        );
        CREATE UNIQUE INDEX recommendation_offers_active_pair ON accounting.recommendation_offers(product_id,partner_id)
            WHERE status IN ('offered','reserved');
        CREATE INDEX recommendation_offers_changed ON accounting.recommendation_offers(changed_at);
        """);

    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        DO $$ BEGIN
          IF EXISTS (SELECT 1 FROM accounting.recommendation_offers) THEN
            RAISE EXCEPTION 'Recommendation offers must be reconciled before removing the ledger';
          END IF;
        END $$;
        DROP TABLE accounting.recommendation_offers;
        """);
}

using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace PoliValko.Infrastructure.Persistence.Migrations;

[DbContext(typeof(PoliValkoDbContext))]
[Migration("20261122200000_RecommendationOfferInvoices")]
public sealed class RecommendationOfferInvoices : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        CREATE SEQUENCE accounting.recommendation_invoice_number;
        ALTER TABLE accounting.recommendation_offers
          ADD COLUMN invoice_id uuid UNIQUE REFERENCES accounting.documents(id),
          DROP CONSTRAINT recommendation_offers_status_check,
          ADD CONSTRAINT recommendation_offers_status_check CHECK (
            status IN ('offered','reserved','declined','released','fulfilled')
            AND (status <> 'fulfilled' OR invoice_id IS NOT NULL)
            AND (invoice_id IS NULL OR status IN ('reserved','released','fulfilled')));
        """);

    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        DO $$ BEGIN
          IF EXISTS (SELECT 1 FROM accounting.recommendation_offers WHERE invoice_id IS NOT NULL) THEN
            RAISE EXCEPTION 'Reconcile linked recommendation invoices before removing their links';
          END IF;
        END $$;
        ALTER TABLE accounting.recommendation_offers
          DROP CONSTRAINT recommendation_offers_status_check, DROP COLUMN invoice_id,
          ADD CONSTRAINT recommendation_offers_status_check CHECK (status IN ('offered','reserved','declined','released'));
        DROP SEQUENCE accounting.recommendation_invoice_number;
        """);
}

using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace PoliValko.Infrastructure.Persistence.Migrations;

[DbContext(typeof(PoliValkoDbContext))]
[Migration("20261120190000_InvoiceOperations")]
public sealed class InvoiceOperations : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        CREATE TABLE accounting.warehouse_stock (
            org_id uuid NOT NULL REFERENCES accounting.references(id),
            store_id uuid NOT NULL REFERENCES accounting.references(id),
            product_id uuid NOT NULL REFERENCES catalog.products(id),
            quantity numeric NOT NULL CHECK(quantity >= 0),
            PRIMARY KEY(org_id,store_id,product_id)
        );
        CREATE TABLE accounting.stock_movements (
            document_id uuid NOT NULL REFERENCES accounting.documents(id),
            product_id uuid NOT NULL REFERENCES catalog.products(id),
            delta numeric NOT NULL CHECK(delta <> 0),
            resulting_quantity numeric NOT NULL CHECK(resulting_quantity >= 0),
            PRIMARY KEY(document_id,product_id)
        );
        CREATE TABLE accounting.stock_openings (
            id uuid PRIMARY KEY, org_id uuid NOT NULL, store_id uuid NOT NULL, product_id uuid NOT NULL,
            quantity numeric NOT NULL CHECK(quantity >= 0), day date NOT NULL, reference text NOT NULL,
            UNIQUE(org_id,store_id,product_id), FOREIGN KEY(org_id,store_id,product_id)
                REFERENCES accounting.warehouse_stock(org_id,store_id,product_id)
        );
        CREATE TABLE accounting.invoice_payments (
            id uuid PRIMARY KEY,
            document_id uuid NOT NULL REFERENCES accounting.documents(id),
            day date NOT NULL, amount numeric NOT NULL CHECK(amount > 0 AND amount=round(amount,2)),
            method text NOT NULL CHECK(method IN ('cash','bank')),
            account_title text NOT NULL, reference text NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE INDEX invoice_payments_document ON accounting.invoice_payments(document_id);
        CREATE INDEX native_invoices_status ON accounting.documents(status,day,id) WHERE native_partner_id IS NOT NULL;
        CREATE VIEW accounting.invoice_operations AS
        SELECT d.id,d.status,d.kind,d.day,d.total,d.currency,d.native_partner_id AS partner_id,
            d.native_org_id AS org_id,d.native_store_id AS store_id,
            coalesce(p.paid,0) AS paid,CASE WHEN d.status='posted' THEN d.total-coalesce(p.paid,0) END AS due
        FROM accounting.documents d
        LEFT JOIN LATERAL (SELECT sum(amount) AS paid FROM accounting.invoice_payments WHERE document_id=d.id) p ON true
        WHERE d.native_partner_id IS NOT NULL AND d.entity_type='invoice' AND d.kind IN ('in','out');
        """);

    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        DROP VIEW accounting.invoice_operations;
        DROP INDEX accounting.native_invoices_status;
        DROP TABLE accounting.invoice_payments,accounting.stock_movements,accounting.stock_openings,accounting.warehouse_stock;
        """);
}

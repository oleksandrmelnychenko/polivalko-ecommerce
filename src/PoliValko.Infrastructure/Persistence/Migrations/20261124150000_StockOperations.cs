using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace PoliValko.Infrastructure.Persistence.Migrations;

[DbContext(typeof(PoliValkoDbContext))]
[Migration("20261124150000_StockOperations")]
public sealed class StockOperations : Migration
{
    // Receipts without documents, write-offs and recounts are console documents without a partner,
    // so catalog lines resolve by the native account instead of by the partner.
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        CREATE SEQUENCE accounting.stock_income_numbers;
        CREATE SEQUENCE accounting.stock_write_off_numbers;
        CREATE SEQUENCE accounting.stock_recount_numbers;
        CREATE OR REPLACE VIEW accounting.document_lines AS
        SELECT d.id AS document_id, item.ordinality AS position, item.value#>>'{product,id}' AS product_ref,
               item.value#>>'{product,title}' AS product, item.value#>>'{product,sku}' AS sku,
               item.value#>>'{store,external_id}' AS store_ref, item.value#>>'{store,title}' AS store,
               item.value->>'quantity' AS quantity, item.value->>'price' AS price,
               item.value->>'total' AS total, item.value AS details,
               coalesce(native_product.id,imported_product.id) AS catalog_id
        FROM accounting.documents d
        CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(d.details->'products')='array'
            THEN d.details->'products' ELSE '[]' END) WITH ORDINALITY AS item(value,ordinality)
        LEFT JOIN catalog.products imported_product ON d.source_account='valko-dntrade'
            AND imported_product.navkolo_id='dntrade-code:' || (item.value#>>'{product,code}')
        LEFT JOIN catalog.products native_product ON d.source_account='polivalko-native'
            AND native_product.id::text=item.value#>>'{product,id}';
        """);

    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        CREATE OR REPLACE VIEW accounting.document_lines AS
        SELECT d.id AS document_id, item.ordinality AS position, item.value#>>'{product,id}' AS product_ref,
               item.value#>>'{product,title}' AS product, item.value#>>'{product,sku}' AS sku,
               item.value#>>'{store,external_id}' AS store_ref, item.value#>>'{store,title}' AS store,
               item.value->>'quantity' AS quantity, item.value->>'price' AS price,
               item.value->>'total' AS total, item.value AS details,
               coalesce(native_product.id,imported_product.id) AS catalog_id
        FROM accounting.documents d
        CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(d.details->'products')='array'
            THEN d.details->'products' ELSE '[]' END) WITH ORDINALITY AS item(value,ordinality)
        LEFT JOIN catalog.products imported_product ON d.source_account='valko-dntrade'
            AND imported_product.navkolo_id='dntrade-code:' || (item.value#>>'{product,code}')
        LEFT JOIN catalog.products native_product ON d.native_partner_id IS NOT NULL
            AND native_product.id::text=item.value#>>'{product,id}';
        DROP SEQUENCE accounting.stock_income_numbers, accounting.stock_write_off_numbers, accounting.stock_recount_numbers;
        """);
}

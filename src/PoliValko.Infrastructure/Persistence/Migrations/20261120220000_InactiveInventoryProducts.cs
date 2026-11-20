using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace PoliValko.Infrastructure.Persistence.Migrations;

[DbContext(typeof(PoliValkoDbContext))]
[Migration("20261120220000_InactiveInventoryProducts")]
public sealed class InactiveInventoryProducts : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        CREATE TABLE accounting.inventory_product_links (
            report_id uuid, position integer, evidence_id uuid NOT NULL, evidence_position integer NOT NULL,
            product_id uuid UNIQUE NOT NULL REFERENCES catalog.products(id),
            PRIMARY KEY(report_id,position),
            FOREIGN KEY(report_id,position) REFERENCES accounting.inventory_lines(report_id,position),
            FOREIGN KEY(evidence_id,evidence_position) REFERENCES accounting.inventory_lines(report_id,position)
        );
        CREATE FUNCTION accounting.inactive_inventory_products(report uuid)
        RETURNS TABLE("position" integer,evidence_id uuid,evidence_position integer,code text,title text,unit text,
            quantity numeric,barcode text,retail_price numeric,purchase_price numeric,category_id uuid,product_id uuid,status text)
        LANGUAGE sql STABLE AS $$
            WITH supplements AS MATERIALIZED (
                SELECT s.id, a.payload::jsonb->'raw' AS raw
                FROM accounting.inventory_reports r JOIN accounting.inventory_reports s
                  ON s.source_account=r.source_account AND s.day=r.day AND s.store_name=r.store_name AND s.kind='inactive'
                JOIN integration.dntrade_archive_records a ON a.id=s.id
                WHERE r.id=report AND r.kind='cutover' AND r.source_account='valko-dntrade'
            ), lines AS (
                SELECT l.*,count(*) OVER(PARTITION BY code) AS copies FROM accounting.inventory_lines l WHERE report_id=report
            ), supplementary_lines AS (
                SELECT l.*,s.raw#>ARRAY['tables','0',(l.position-1)::text,'cells'] AS cells,
                       count(*) OVER(PARTITION BY l.code) AS copies
                FROM supplements s JOIN accounting.inventory_lines l ON l.report_id=s.id
            ), details AS (
                SELECT s.id,j,count(*) OVER(PARTITION BY j->>'sku') AS copies FROM supplements s
                CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(s.raw->'products')='array'
                    THEN s.raw->'products' ELSE '[]'::jsonb END) j
            )
            SELECT l.position,s.report_id,s.position,l.code,l.title,l.unit,l.quantity,nullif(j->>'barcode',''),
                   price.retail,price.purchase,c.id,link.product_id,
                   CASE WHEN link.product_id IS NOT NULL THEN 'linked'
                        WHEN EXISTS(SELECT 1 FROM catalog.products p WHERE p.sku=l.code OR
                            p.navkolo_id='dntrade-code:'||l.code OR p.slug='dntrade-inactive-'||l.code) THEN 'conflict'
                        WHEN c.id IS NULL THEN 'category' ELSE 'available' END
            FROM lines l JOIN supplementary_lines s ON (s.code,s.title,s.unit,s.quantity)=(l.code,l.title,l.unit,l.quantity)
            JOIN details d ON d.id=s.report_id AND j->>'sku'=l.code AND j->>'name'=l.title AND j->>'unit'=l.unit
            CROSS JOIN LATERAL (SELECT accounting.stock_number(j->>'retailPrice') AS retail,
                                       accounting.stock_number(j->>'purchasePrice') AS purchase) price
            LEFT JOIN catalog.categories c ON c.slug='dntrade-uncategorized' AND NOT c.is_visible
            LEFT JOIN accounting.inventory_product_links link ON link.report_id=report AND link.position=l.position
            WHERE l.copies=1 AND s.copies=1 AND d.copies=1 AND l.consistent AND l.quantity>0 AND l.quantity<=1000000000
              AND l.quantity=round(l.quantity,3) AND l.code ~ '^[0-9]{1,40}$'
              AND length(l.title) BETWEEN 1 AND 500 AND length(l.unit) BETWEEN 1 AND 300
              AND length(coalesce(j->>'barcode',''))<=300 AND accounting.stock_number(j->>'onHand')=l.quantity
              AND j->>'status'='deactivated' AND s.cells#>>'{7,value}'='Деактивований'
              AND coalesce(s.cells#>>'{3,value}','')=coalesce(j->>'barcode','')
              AND price.retail BETWEEN 0 AND 9999999999.99 AND price.retail=round(price.retail,2)
              AND price.retail=accounting.stock_number(s.cells#>>'{6,value}')
              AND price.purchase=accounting.stock_number(s.cells#>>'{5,value}')
        $$;
        """);

    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        DROP FUNCTION accounting.inactive_inventory_products(uuid);
        DROP TABLE accounting.inventory_product_links;
        """);
}

using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace PoliValko.Infrastructure.Persistence.Migrations;

[DbContext(typeof(PoliValkoDbContext))]
[Migration("20261120183000_AccountingProductHistory")]
public sealed class AccountingProductHistory : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        CREATE TABLE accounting.product_document_lines (
            document_id uuid NOT NULL REFERENCES accounting.documents(id), position integer NOT NULL,
            source_account text NOT NULL, product_ref text NOT NULL, PRIMARY KEY(document_id,position)
        );
        CREATE INDEX product_document_history ON accounting.product_document_lines(source_account,product_ref);
        CREATE FUNCTION accounting.index_document_lines() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            INSERT INTO accounting.product_document_lines
            SELECT NEW.id,n::int,NEW.source_account,lower(p#>>'{product,id}')
            FROM jsonb_array_elements(CASE WHEN jsonb_typeof(NEW.details->'products')='array'
                THEN NEW.details->'products' ELSE '[]' END) WITH ORDINALITY AS t(p,n)
            WHERE nullif(p#>>'{product,id}','') IS NOT NULL;
            RETURN NEW;
        END $$;
        LOCK TABLE accounting.documents IN SHARE ROW EXCLUSIVE MODE;
        CREATE TRIGGER register_product_lines AFTER INSERT ON accounting.documents
            FOR EACH ROW EXECUTE FUNCTION accounting.index_document_lines();
        INSERT INTO accounting.product_document_lines
        SELECT d.id,n::int,d.source_account,lower(p#>>'{product,id}') FROM accounting.documents d
        CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(d.details->'products')='array'
            THEN d.details->'products' ELSE '[]' END) WITH ORDINALITY AS t(p,n)
        WHERE nullif(p#>>'{product,id}','') IS NOT NULL;
        """);

    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        DROP TRIGGER register_product_lines ON accounting.documents;
        DROP FUNCTION accounting.index_document_lines();
        DROP TABLE accounting.product_document_lines;
        """);
}

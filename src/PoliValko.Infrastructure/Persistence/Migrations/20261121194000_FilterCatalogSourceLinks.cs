using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace PoliValko.Infrastructure.Persistence.Migrations;

[DbContext(typeof(PoliValkoDbContext))]
[Migration("20261121194000_FilterCatalogSourceLinks")]
public sealed class FilterCatalogSourceLinks : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        CREATE OR REPLACE FUNCTION catalog.filter_product_source_links() RETURNS trigger
        LANGUAGE plpgsql AS $filter$
        DECLARE
            -- Generated credits are plain anchor labels. Other links, including photo credits, are editorial content.
            source_label CONSTANT text := '(?:дані\s+виробника(?:\s+[^<>]+)?|(?:дані|характеристики)\s+постачальника)';
            external_anchor CONSTANT text := '<a\s+(?:[^<>]*?\s)?href\s*=\s*["'']?https?://[^<>]*>\s*' || source_label || '\s*</a\s*>';
        BEGIN
            NEW.description_html := regexp_replace(NEW.description_html,
                '<p(?:\s+[^<>]*)?>\s*' || external_anchor || '\s*</p\s*>', '', 'gi');
            NEW.description_html := regexp_replace(NEW.description_html, external_anchor, '', 'gi');
            IF btrim(NEW.description_html) = '' THEN
                NEW.description_html := NULL;
            END IF;
            RETURN NEW;
        END;
        $filter$;

        CREATE OR REPLACE TRIGGER filter_product_source_links
        BEFORE INSERT OR UPDATE OF description_html ON catalog.products
        FOR EACH ROW WHEN (NEW.description_html ~* '(виробника|постачальника)' AND NEW.description_html ~* '<a\s')
        EXECUTE FUNCTION catalog.filter_product_source_links();
        """);

    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        DROP TRIGGER filter_product_source_links ON catalog.products;
        DROP FUNCTION catalog.filter_product_source_links();
        """);
}

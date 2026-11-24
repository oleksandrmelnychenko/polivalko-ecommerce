using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace PoliValko.Infrastructure.Persistence.Migrations;

[DbContext(typeof(PoliValkoDbContext))]
[Migration("20261124120000_DocumentPartnerNames")]
public sealed class DocumentPartnerNames : Migration
{
    // Documents keep the partner name they were imported with; registers show the card's current name instead.
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        CREATE OR REPLACE VIEW accounting.document_register AS
        SELECT d.id,d.entity_type,d.kind,d.number,d.day,d.status,d.source_account,d.source_id,
               d.organization,d.organization_id,coalesce(card.title,d.partner_title) AS partner_title,d.partner_ref,
               coalesce(d.native_partner_id,p.id) AS partner_id,d.agreement,
               d.currency,d.total::text AS amount,d.parent_ref,d.parent_kind
        FROM accounting.documents d
        LEFT JOIN LATERAL (
            SELECT (array_agg(p.id))[1] AS id FROM accounting.partners p
            WHERE p.source_account=d.source_account AND lower(p.source_id)=lower(d.partner_ref)
            HAVING count(*)=1
        ) p ON true
        LEFT JOIN accounting.partners card ON card.id=coalesce(d.native_partner_id,p.id);
        """);

    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        CREATE OR REPLACE VIEW accounting.document_register AS
        SELECT d.id,d.entity_type,d.kind,d.number,d.day,d.status,d.source_account,d.source_id,
               d.organization,d.organization_id,d.partner_title,d.partner_ref,coalesce(d.native_partner_id,p.id) AS partner_id,d.agreement,
               d.currency,d.total::text AS amount,d.parent_ref,d.parent_kind
        FROM accounting.documents d
        LEFT JOIN LATERAL (
            SELECT (array_agg(p.id))[1] AS id FROM accounting.partners p
            WHERE p.source_account=d.source_account AND lower(p.source_id)=lower(d.partner_ref)
            HAVING count(*)=1
        ) p ON true;
        """);
}

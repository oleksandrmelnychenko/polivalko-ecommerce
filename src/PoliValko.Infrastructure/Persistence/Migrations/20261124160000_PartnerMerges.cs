using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace PoliValko.Infrastructure.Persistence.Migrations;

[DbContext(typeof(PoliValkoDbContext))]
[Migration("20261124160000_PartnerMerges")]
public sealed class PartnerMerges : Migration
{
    // A duplicate card is kept and points at its main card. Rows that hold a card id move to the main card at merge
    // time (logged in partner_merges for undo); imported documents name the partner by its DNTrade code, so the
    // register and the report candidates resolve that code to the main card when they read it.
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        ALTER TABLE accounting.partners ADD COLUMN merged_into uuid REFERENCES accounting.partners(id),
            ADD CONSTRAINT partner_not_merged_into_itself CHECK (merged_into <> id);
        CREATE INDEX partners_merged ON accounting.partners(merged_into) WHERE merged_into IS NOT NULL;
        CREATE TABLE accounting.partner_merges (
            duplicate_id uuid PRIMARY KEY REFERENCES accounting.partners(id),
            main_id uuid NOT NULL REFERENCES accounting.partners(id),
            merged_at timestamptz NOT NULL DEFAULT now(),
            moved jsonb NOT NULL
        );
        CREATE OR REPLACE VIEW accounting.partner_name_candidates AS
        SELECT p.source_account,trim(regexp_replace(lower(coalesce(p.source_title,p.title)),'[[:space:]  ]+',' ','g')) AS name,
            count(DISTINCT coalesce(p.merged_into,p.id))::int AS candidate_count,
            CASE WHEN count(DISTINCT coalesce(p.merged_into,p.id))=1 THEN (array_agg(coalesce(p.merged_into,p.id)))[1] END AS candidate
        FROM accounting.partners p GROUP BY 1,2;
        CREATE OR REPLACE VIEW accounting.document_register AS
        SELECT d.id,d.entity_type,d.kind,d.number,d.day,d.status,d.source_account,d.source_id,
               d.organization,d.organization_id,coalesce(card.title,d.partner_title) AS partner_title,d.partner_ref,
               coalesce(d.native_partner_id,p.id) AS partner_id,d.agreement,
               d.currency,d.total::text AS amount,d.parent_ref,d.parent_kind
        FROM accounting.documents d
        LEFT JOIN LATERAL (
            SELECT (array_agg(coalesce(p.merged_into,p.id)))[1] AS id FROM accounting.partners p
            WHERE p.source_account=d.source_account AND lower(p.source_id)=lower(d.partner_ref)
            HAVING count(*)=1
        ) p ON true
        LEFT JOIN accounting.partners card ON card.id=coalesce(d.native_partner_id,p.id);
        """);

    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        DO $$ BEGIN
          IF EXISTS (SELECT 1 FROM accounting.partner_merges) THEN
            RAISE EXCEPTION 'Undo every partner merge before removing merges';
          END IF;
        END $$;
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
        CREATE OR REPLACE VIEW accounting.partner_name_candidates AS
        SELECT p.source_account,trim(regexp_replace(lower(coalesce(p.source_title,p.title)),'[[:space:]  ]+',' ','g')) AS name,
            count(*)::int AS candidate_count,CASE WHEN count(*)=1 THEN (array_agg(p.id))[1] END AS candidate
        FROM accounting.partners p GROUP BY 1,2;
        DROP TABLE accounting.partner_merges;
        DROP INDEX accounting.partners_merged;
        ALTER TABLE accounting.partners DROP CONSTRAINT partner_not_merged_into_itself, DROP COLUMN merged_into;
        """);
}

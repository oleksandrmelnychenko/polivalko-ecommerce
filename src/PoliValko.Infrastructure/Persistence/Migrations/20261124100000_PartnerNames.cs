using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace PoliValko.Infrastructure.Persistence.Migrations;

[DbContext(typeof(PoliValkoDbContext))]
[Migration("20261124100000_PartnerNames")]
public sealed class PartnerNames : Migration
{
    // The console now owns partner names. The imported name stays in source_title because
    // balance reports from the old system still name partners that way.
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        ALTER TABLE accounting.partners ADD COLUMN source_title text, ADD COLUMN note text
            CHECK (note IS NULL OR (length(note) BETWEEN 1 AND 500));
        UPDATE accounting.partners SET source_title=title WHERE source_account<>'polivalko-native';
        -- One row per imported name: a balance report row links to the partner only when the name is unique.
        CREATE VIEW accounting.partner_name_candidates AS
        SELECT p.source_account,trim(regexp_replace(lower(coalesce(p.source_title,p.title)),'[[:space:]  ]+',' ','g')) AS name,
            count(*)::int AS candidate_count,CASE WHEN count(*)=1 THEN (array_agg(p.id))[1] END AS candidate
        FROM accounting.partners p GROUP BY 1,2;
        """);

    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        DROP VIEW accounting.partner_name_candidates;
        UPDATE accounting.partners SET title=source_title WHERE source_title IS NOT NULL;
        ALTER TABLE accounting.partners DROP COLUMN note, DROP COLUMN source_title;
        """);
}

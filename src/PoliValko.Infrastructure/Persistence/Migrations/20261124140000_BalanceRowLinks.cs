using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace PoliValko.Infrastructure.Persistence.Migrations;

[DbContext(typeof(PoliValkoDbContext))]
[Migration("20261124140000_BalanceRowLinks")]
public sealed class BalanceRowLinks : Migration
{
    // DNTrade groups partners with the same name under one heading, so a single row can belong to another card.
    // A row link overrides the heading link for that row; an opening is checked against the row's effective link.
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        CREATE TABLE accounting.balance_row_links (
            report_id uuid NOT NULL REFERENCES accounting.balance_reports(id), position bigint NOT NULL,
            partner_id uuid NOT NULL REFERENCES accounting.partners(id), PRIMARY KEY(report_id,position)
        );
        DO $$ DECLARE fk text;
        BEGIN
          SELECT conname INTO STRICT fk FROM pg_constraint
          WHERE conrelid='accounting.partner_openings'::regclass AND contype='f'
            AND confrelid='accounting.balance_partner_links'::regclass;
          EXECUTE format('ALTER TABLE accounting.partner_openings DROP CONSTRAINT %I', fk);
        END $$;
        """);

    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        DO $$ BEGIN
          IF EXISTS (SELECT 1 FROM accounting.partner_openings o JOIN accounting.balance_row_links r USING(report_id,position)) THEN
            RAISE EXCEPTION 'Openings confirmed through row links must be reconciled first';
          END IF;
        END $$;
        DROP TABLE accounting.balance_row_links;
        ALTER TABLE accounting.partner_openings ADD FOREIGN KEY(report_id,heading_position,partner_id)
            REFERENCES accounting.balance_partner_links(report_id,heading_position,partner_id);
        """);
}

using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace PoliValko.Infrastructure.Persistence.Migrations;

[DbContext(typeof(PoliValkoDbContext))]
[Migration("20261120193000_PartnerOpenings")]
public sealed class PartnerOpenings : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        CREATE TABLE accounting.opening_reports (
            source_account text PRIMARY KEY,
            report_id uuid UNIQUE NOT NULL REFERENCES accounting.balance_reports(id)
        );
        ALTER TABLE accounting.balance_partner_links ADD CONSTRAINT balance_partner_link_identity UNIQUE(report_id,heading_position,partner_id);
        CREATE TABLE accounting.partner_openings (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            report_id uuid NOT NULL REFERENCES accounting.opening_reports(report_id),
            position bigint NOT NULL, heading_position bigint NOT NULL,
            partner_id uuid NOT NULL REFERENCES accounting.partners(id),
            org_id uuid NOT NULL REFERENCES accounting.references(id),
            direction text NOT NULL CHECK(direction IN ('receivable','payable')),
            amount numeric NOT NULL CHECK(amount>0 AND amount=round(amount,2)), day date NOT NULL,
            UNIQUE(report_id,position),
            FOREIGN KEY(report_id,heading_position,partner_id) REFERENCES accounting.balance_partner_links(report_id,heading_position,partner_id)
        );
        CREATE INDEX partner_openings_partner ON accounting.partner_openings(partner_id,org_id);
        ALTER TABLE accounting.invoice_payments ALTER COLUMN document_id DROP NOT NULL,
            ADD COLUMN opening_id uuid REFERENCES accounting.partner_openings(id),
            ADD CONSTRAINT payment_single_target CHECK(num_nonnulls(document_id,opening_id)=1);
        CREATE INDEX payments_opening ON accounting.invoice_payments(opening_id) WHERE opening_id IS NOT NULL;
        CREATE VIEW accounting.partner_opening_balances AS
        SELECT o.*,o.amount-coalesce(p.paid,0) AS due FROM accounting.partner_openings o
        LEFT JOIN LATERAL (SELECT sum(amount) AS paid FROM accounting.invoice_payments WHERE opening_id=o.id) p ON true;
        CREATE VIEW accounting.current_partner_balances AS
        WITH debts AS (
            SELECT partner_id,org_id,currency,kind='out' AS receivable,due FROM accounting.invoice_operations WHERE status='posted'
            UNION ALL
            SELECT partner_id,org_id,'UAH',direction='receivable',due FROM accounting.partner_opening_balances
        )
        SELECT partner_id,org_id,currency,coalesce(sum(due) FILTER(WHERE receivable),0) AS receivable,
            coalesce(sum(due) FILTER(WHERE NOT receivable),0) AS payable
        FROM debts GROUP BY partner_id,org_id,currency;
        """);

    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        DROP VIEW accounting.current_partner_balances,accounting.partner_opening_balances;
        ALTER TABLE accounting.invoice_payments ALTER COLUMN document_id SET NOT NULL,
            DROP CONSTRAINT payment_single_target, DROP COLUMN opening_id;
        DROP TABLE accounting.partner_openings,accounting.opening_reports;
        ALTER TABLE accounting.balance_partner_links DROP CONSTRAINT balance_partner_link_identity;
        """);
}

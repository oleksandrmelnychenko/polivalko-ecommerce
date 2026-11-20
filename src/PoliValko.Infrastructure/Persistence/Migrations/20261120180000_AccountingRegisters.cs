using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace PoliValko.Infrastructure.Persistence.Migrations;

[DbContext(typeof(PoliValkoDbContext))]
[Migration("20261120180000_AccountingRegisters")]
public sealed class AccountingRegisters : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        using var stream = typeof(AccountingRegisters).Assembly.GetManifestResourceStream("AccountingRegisters.sql")
            ?? throw new InvalidOperationException("Missing accounting register schema.");
        using var reader = new StreamReader(stream);
        migrationBuilder.Sql(reader.ReadToEnd());
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            DROP TRIGGER accounting_register_import ON integration.dntrade_archive_records;
            DROP FUNCTION accounting.import_archive_record();
            DROP FUNCTION accounting.copy_record(integration.dntrade_archive_records);
            DROP VIEW accounting.settlements, accounting.document_lines, accounting.document_register;
            DROP TABLE accounting.balance_partner_links;
            DROP TABLE accounting.balance_reports, accounting.documents, accounting.partners;
            DROP TABLE accounting.references;
            DROP FUNCTION accounting.uah_amount(text);
            DROP SCHEMA accounting;
            """);
    }
}

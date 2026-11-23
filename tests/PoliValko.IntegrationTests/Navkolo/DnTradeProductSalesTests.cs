using System.Globalization;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PoliValko.Catalog.Domain;
using PoliValko.Navkolo.Contracts;
using PoliValko.Navkolo.Features.SalesArchive;

namespace PoliValko.IntegrationTests;

public sealed class DnTradeProductSalesTests(ApiFactory api)
{
    [Fact]
    public async Task Archive_uses_the_day_written_in_a_document_and_actual_movement_without_double_counting_invoices_and_receipts()
    {
        var ct = TestContext.Current.CancellationToken;
        var account = $"analytics-{Guid.NewGuid():N}";
        var catalog = await api.AddProductAsync("ruchnyi-instrument", "Імпортований товар", 40m);
        var code = Random.Shared.Next(1_000_000_001, int.MaxValue);
        var providerProduct = Guid.NewGuid();
        var unmatchedProduct = Guid.NewGuid();
        var linkedInvoice = Guid.NewGuid();
        var invoice = Guid.NewGuid();
        var from = new DateOnly(2014, 11, 2);
        var to = new DateOnly(2014, 11, 3);
        try
        {
            await api.WithDbAsync(async db =>
            {
                var externalId = "dntrade-code:" + code.ToString(CultureInfo.InvariantCulture);
                await db.Set<Product>().Where(p => p.Id == catalog.Id).ExecuteUpdateAsync(
                    p => p.SetProperty(x => x.NavkoloId, externalId), ct);

                var archive = string.Join('\n',
                    Invoice("invoice", linkedInvoice, "3", "2014-11-01", providerProduct, code, "9", "360"),
                    Invoice("receipt", Guid.NewGuid(), "6", "2014-11-02", providerProduct, code, "9", "360", parent: linkedInvoice),
                    // DNTrade marks the shop's clock time as UTC: half past eleven at night is still 2 November.
                    Invoice("invoice", invoice, "3", "2014-11-02T23:30:00Z", providerProduct, code, "2.5", "100"),
                    Invoice("receipt", invoice, "3", "2014-11-02T23:30:00Z", providerProduct, code, "2.5", "100"),
                    Invoice("invoice", Guid.NewGuid(), "6", "2014-11-02", unmatchedProduct, 1, "1", "55"),
                    Invoice("customerReturn", Guid.NewGuid(), "7", "2014-11-03", providerProduct, code, "-0.5", "-20"),
                    Invoice("invoice", Guid.NewGuid(), "3", "2014-11-02", providerProduct, code, "100", "4000", status: "deactivated"),
                    Invoice("invoice", Guid.NewGuid(), "2", "2014-11-02", providerProduct, code, "100", "4000"),
                    Invoice("cashOrder", Guid.NewGuid(), "3", "2014-11-02", providerProduct, code, "100", "4000"),
                    Invoice("invoice", Guid.NewGuid(), "3", "2014-11-02", providerProduct, code, "100", "4000", currency: 840),
                    Invoice("invoice", Guid.NewGuid(), "3", "2014-11-02", providerProduct, code, "100", "?"));
                using var bytes = new MemoryStream(Encoding.UTF8.GetBytes(archive));
                db.AddRange(await DnTradeArchiveInput.ReadAsync(bytes, account, DateTimeOffset.UtcNow, ct));
                return await db.SaveChangesAsync(ct);
            });

            var report = await api.WithScopeAsync(sp => sp.GetRequiredService<IDnTradeProductSales>().ReadAsync(from, to, ct));
            report.FirstSourceDay.ShouldNotBeNull();
            (report.FirstSourceDay < from).ShouldBeTrue();
            report.IgnoredDocuments.ShouldBe(2);
            report.UnmatchedLines.ShouldBe(1);
            report.ReturnsAvailable.ShouldBeTrue();

            var sale = report.Rows.Single(row => row.Day == from && row.CatalogProductId == catalog.Id);
            sale.Name.ShouldBe(catalog.Name);
            sale.SoldUnits.ShouldBe(2.5m);
            sale.GrossRevenue.ShouldBe(100m);
            var standalone = report.Rows.Single(row => row.CatalogProductId is null);
            standalone.ProductKey.ShouldBe($"dntrade:{unmatchedProduct}");
            standalone.GrossRevenue.ShouldBe(55m);
            var returned = report.Rows.Single(row => row.Day == to && row.CatalogProductId == catalog.Id);
            returned.ReturnedUnits.ShouldBe(0.5m);
            returned.ReturnValue.ShouldBe(20m);
        }
        finally
        {
            await api.WithDbAsync(async db =>
            {
                await db.Set<DnTradeArchiveRecord>().Where(r => r.SourceAccount == account).ExecuteDeleteAsync(ct);
                return await db.Set<Product>().Where(p => p.Id == catalog.Id).ExecuteDeleteAsync(ct);
            });
        }
    }

    private static string Invoice(string entity, Guid id, string type, string date, Guid product, int code,
        string quantity, string total, string status = "active", int currency = 980, Guid? parent = null) =>
        JsonSerializer.Serialize(new
        {
            schemaVersion = 1, source = "dntrade", entityType = entity, sourceId = id.ToString(), sourceDate = date,
            providerTypeCode = type,
            raw = new
            {
                external_id = id, type, status, currency_iso = currency, parent_document = parent,
                products = new[] { new { quantity, total, product = new { id = product, code, title = "Товар з архіву" } } },
            },
        });
}

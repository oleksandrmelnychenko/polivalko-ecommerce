using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Contracts;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Navkolo.Contracts;
using PoliValko.SharedKernel;

namespace PoliValko.Navkolo.Features.SalesArchive;

internal sealed class DnTradeProductSales(PoliValkoDbContext db, ICatalogReporting catalog) : IDnTradeProductSales
{
    private static readonly string[] SalesEntities = ["invoice", "receipt", "customerReturn"];

    public async Task<ProductSalesData> ReadAsync(DateOnly from, DateOnly to, CancellationToken ct)
    {
        var archive = db.Set<DnTradeArchiveRecord>().AsNoTracking()
            .Where(r => SalesEntities.Contains(r.EntityType) && r.SourceDay.HasValue);
        var firstDay = await BoundaryAsync(archive.OrderBy(r => r.SourceDay), latest: false, ct);
        var lastDay = firstDay is null ? null : await BoundaryAsync(archive.OrderByDescending(r => r.SourceDay), latest: true, ct);
        var documentKeys = new HashSet<string>(StringComparer.Ordinal);
        var invoiceKeys = new HashSet<string>(StringComparer.Ordinal);
        var linkedReceipts = new List<DnTradeSalesDocument>();
        var daily = new Dictionary<(DateOnly, string, string), ArchivedProductDay>();
        var accounts = new HashSet<string>(StringComparer.Ordinal);
        var ignored = 0;
        var returnsAvailable = false;

        await foreach (var record in ForPeriod(archive, from, to).OrderBy(r => r.SourceDay).ThenBy(r => r.Id)
            .AsAsyncEnumerable().WithCancellation(ct))
        {
            if (DnTradeSalesDocument.BusinessDay(record) is not { } day || day < from || day > to) continue;
            var document = DnTradeSalesDocument.Read(record, day, out var incomplete);
            if (incomplete) ignored++;
            if (document is null) continue;

            var key = DocumentKey(document.Account, document.Id);
            if (document.Kind == DnTradeSalesKind.Invoice)
            {
                invoiceKeys.Add(key);
                invoiceKeys.Add(DocumentKey(record.SourceAccount, record.SourceId));
            }

            if (!documentKeys.Add(key)) continue;
            if (document.Kind == DnTradeSalesKind.Receipt && document.ParentId is not null)
            {
                linkedReceipts.Add(document);
                continue;
            }

            if (document.Kind == DnTradeSalesKind.Return) returnsAvailable = true;
            AddLines(document, daily, accounts);
        }

        // An archived receipt explicitly tied to a recognized invoice is not a second product sale.
        await FindReferencedInvoicesAsync(archive, invoiceKeys, linkedReceipts, ct);
        foreach (var receipt in linkedReceipts.Where(x => !invoiceKeys.Contains(DocumentKey(x.Account, x.ParentId!))))
        {
            AddLines(receipt, daily, accounts);
        }

        var (rows, unmatchedLines) = await MatchProductsAsync(daily.Values, accounts.Count == 1, ct);
        return new ProductSalesData(rows, firstDay, lastDay, ignored, unmatchedLines, returnsAvailable);
    }

    private static IQueryable<DnTradeArchiveRecord> ForPeriod(IQueryable<DnTradeArchiveRecord> archive, DateOnly from, DateOnly to)
    {
        // A timestamp archived with another UTC offset can map to the neighboring Kyiv day.
        var start = from == DateOnly.MinValue ? from : from.AddDays(-1);
        var end = to == DateOnly.MaxValue ? to : to.AddDays(1);
        return archive.Where(r => r.SourceDay >= start && r.SourceDay <= end);
    }

    private static async Task<DateOnly?> BoundaryAsync(IQueryable<DnTradeArchiveRecord> ordered, bool latest, CancellationToken ct)
    {
        DateOnly? boundary = null;
        int? firstMatchedSourceDay = null;
        await foreach (var record in ordered.AsAsyncEnumerable().WithCancellation(ct))
        {
            var sourceDay = record.SourceDay!.Value.DayNumber;
            if (firstMatchedSourceDay is { } matched && Math.Abs(sourceDay - matched) > 1) break;
            if (DnTradeSalesDocument.BusinessDay(record) is not { } day || DnTradeSalesDocument.Read(record, day, out _) is null) continue;
            firstMatchedSourceDay ??= sourceDay;
            if (boundary is null || (latest ? day > boundary : day < boundary)) boundary = day;
        }

        return boundary;
    }

    private static async Task FindReferencedInvoicesAsync(IQueryable<DnTradeArchiveRecord> archive, HashSet<string> invoiceKeys,
        IReadOnlyList<DnTradeSalesDocument> receipts, CancellationToken ct)
    {
        foreach (var account in receipts.Where(r => !invoiceKeys.Contains(DocumentKey(r.Account, r.ParentId!))).GroupBy(r => r.Account))
        {
            var references = account.Select(r => r.ParentId!).Distinct(StringComparer.Ordinal).ToArray();
            var candidates = archive.Where(r => r.SourceAccount == account.Key && r.EntityType == "invoice" && references.Contains(r.SourceId));
            await foreach (var candidate in candidates.AsAsyncEnumerable().WithCancellation(ct))
            {
                if (DnTradeSalesDocument.BusinessDay(candidate) is not { } day) continue;
                if (DnTradeSalesDocument.Read(candidate, day, out _) is { Kind: DnTradeSalesKind.Invoice } invoice)
                {
                    invoiceKeys.Add(DocumentKey(invoice.Account, invoice.Id));
                    invoiceKeys.Add(DocumentKey(candidate.SourceAccount, candidate.SourceId));
                }
            }
        }
    }

    private static void AddLines(DnTradeSalesDocument document, Dictionary<(DateOnly, string, string), ArchivedProductDay> daily,
        HashSet<string> accounts)
    {
        accounts.Add(document.Account);
        var isReturn = document.Kind == DnTradeSalesKind.Return;
        foreach (var line in document.Lines)
        {
            var key = (document.Day, document.Account, ProductKey(document.Account, line));
            if (!daily.TryGetValue(key, out var aggregate))
            {
                aggregate = new ArchivedProductDay(document.Day, key.Item3, line);
                daily.Add(key, aggregate);
            }

            aggregate.Lines++;
            if (isReturn)
            {
                aggregate.ReturnedUnits += line.Quantity;
                aggregate.ReturnValue += line.Total;
            }
            else
            {
                aggregate.SoldUnits += line.Quantity;
                aggregate.GrossRevenue += line.Total;
            }
        }
    }

    private async Task<(ProductSalesDay[] Rows, int UnmatchedLines)> MatchProductsAsync(IEnumerable<ArchivedProductDay> daily,
        bool singleAccount, CancellationToken ct)
    {
        var externalIds = new HashSet<string>(StringComparer.Ordinal);
        var skus = new HashSet<string>(StringComparer.Ordinal);
        foreach (var item in daily)
        {
            if (item.Product.ProviderId is { } providerId) externalIds.Add(providerId);
            if (singleAccount && item.Product.Code is { } code) externalIds.Add(ImportedCode(code));
            if (singleAccount && item.Product.ProviderId is null && item.Product.Code is null && item.Product.Sku is { } sku) skus.Add(sku);
        }

        var products = await catalog.FindAnalyticsProductsAsync(externalIds, skus, ct);
        var byExternalId = products.ToDictionary(p => p.ExternalId, StringComparer.Ordinal);
        var bySku = products.ToLookup(p => p.Sku, StringComparer.Ordinal);
        var rows = new Dictionary<(DateOnly, string), ProductSalesDay>();
        var unmatched = 0;
        foreach (var item in daily)
        {
            var line = item.Product;
            var match = line.ProviderId is { } id ? byExternalId.GetValueOrDefault(id) : null;
            if (match is null && singleAccount)
            {
                if (line.Code is { } code) match = byExternalId.GetValueOrDefault(ImportedCode(code));
                else if (line.ProviderId is null && line.Sku is { } sku && bySku[sku].Count() == 1) match = bySku[sku].Single();
            }

            if (match is null) unmatched += item.Lines;
            var key = (item.Day, match?.Id.ToString() ?? item.ProductKey);
            var row = rows.GetValueOrDefault(key) ?? new ProductSalesDay(item.Day, key.Item2, match?.Id, match?.Name ?? line.Name,
                match?.Sku ?? line.Sku ?? line.Code ?? string.Empty, 0, 0, 0, 0);
            rows[key] = row with
            {
                SoldUnits = row.SoldUnits + item.SoldUnits,
                ReturnedUnits = row.ReturnedUnits + item.ReturnedUnits,
                GrossRevenue = row.GrossRevenue + item.GrossRevenue,
                ReturnValue = row.ReturnValue + item.ReturnValue,
            };
        }

        return (rows.Values.ToArray(), unmatched);
    }

    private static string DocumentKey(string account, string id) => Guid.TryParse(id, out var guid)
        ? guid.ToString() : $"{account}:{id}";

    private static string ProductKey(string account, DnTradeSalesLine line) => line.ProviderId is { } id
        ? $"dntrade:{id}" : line.Code is { } code ? $"dntrade:{account}:code:{code}" : $"dntrade:{account}:sku:{line.Sku}";

    private static string ImportedCode(string code) => "dntrade-code:" + code;

    private sealed class ArchivedProductDay(DateOnly day, string productKey, DnTradeSalesLine product)
    {
        public DateOnly Day { get; } = day;
        public string ProductKey { get; } = productKey;
        public DnTradeSalesLine Product { get; } = product;
        public int Lines { get; set; }
        public decimal SoldUnits { get; set; }
        public decimal ReturnedUnits { get; set; }
        public decimal GrossRevenue { get; set; }
        public decimal ReturnValue { get; set; }
    }
}

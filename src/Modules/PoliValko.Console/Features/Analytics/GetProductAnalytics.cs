using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using PoliValko.Catalog.Contracts;
using PoliValko.Infrastructure.Web;
using PoliValko.Navkolo.Contracts;
using PoliValko.Ordering.Contracts;
using PoliValko.SharedKernel;

namespace PoliValko.Console.Features.Analytics;

internal static class GetProductAnalytics
{
    private static readonly int[] AllowedDays = [30, 90, 180, 365];

    public static async Task<Results<Ok<ProductAnalyticsDto>, ValidationProblem, ProblemHttpResult>> HandleAsync(
        string? source, int? days, string? product, string? search, int? page, DateOnly? end,
        [FromServices] IWebsiteProductSales website, [FromServices] IDnTradeProductSales archive,
        [FromServices] ICatalogReporting catalog, [FromServices] ProductAnalyticsSourceCache cache,
        [FromServices] ProductAnalyticsClient analytics,
        HttpContext http, TimeProvider time, CancellationToken ct)
    {
        http.Response.Headers.CacheControl = "private, no-store";
        source ??= "web";
        var length = days ?? 90;
        var pageNumber = page ?? 1;
        var yesterday = KyivTime.Today(time).AddDays(-1);
        var to = end ?? yesterday;
        product = NullIfBlank(product);
        search = NullIfBlank(search);

        Dictionary<string, string[]> errors = [];
        if (source is not ("web" or "dntrade")) errors["source"] = ["Оберіть джерело web або dntrade."];
        if (!AllowedDays.Contains(length)) errors["days"] = ["Допустимі періоди: 30, 90, 180 або 365 днів."];
        if (to > yesterday || to.Year < 2000) errors["end"] = ["Дата має бути між 2000 роком і вчорашнім днем включно."];
        if (pageNumber < 1) errors["page"] = ["Номер сторінки має бути додатним."];
        if (product?.Length > 512) errors["product"] = ["Задовгий ідентифікатор товару."];
        if (search?.Length > 120) errors["search"] = ["Скоротіть пошук до 120 символів."];
        if (errors.Count > 0) return TypedResults.ValidationProblem(errors);
        if (!analytics.IsConfigured) return ServiceUnavailable();

        var historyFrom = new DateOnly(to.Year, to.Month, 1).AddMonths(-36);
        var sales = await cache.ReadAsync(source, historyFrom, to, source == "web" ? website.ReadAsync : archive.ReadAsync, ct);
        if (end is null && source == "dntrade" && sales.LastSourceDay is { Year: >= 2000 } last && last < to)
        {
            to = last;
            var archiveStart = new DateOnly(to.Year, to.Month, 1).AddMonths(-36);
            if (archiveStart < historyFrom)
                sales = await cache.ReadAsync(source, archiveStart, to, archive.ReadAsync, ct);
        }
        var from = to.AddDays(1 - length);
        var previousFrom = from.AddDays(-length);

        if (Guid.TryParseExact(product, "D", out var productId))
        {
            product = productId.ToString("D");
        }

        var catalogIds = sales.Rows.Where(row => row.Day >= previousFrom || row.ProductKey == product)
            .Select(row => row.CatalogProductId).OfType<Guid>().ToHashSet();
        if (productId != Guid.Empty) catalogIds.Add(productId);
        var catalogProducts = await catalog.GetAnalyticsProductsAsync(catalogIds, ct);
        var inventory = await catalog.GetAnalyticsInventoryAsync(ct);
        var report = await analytics.BuildAsync(new ProductAnalyticsRequest(
            source, from, to, previousFrom, to == yesterday, product, search, pageNumber, sales, catalogProducts, inventory), ct);
        return report is null ? ServiceUnavailable() : TypedResults.Ok(report);
    }

    private static ProblemHttpResult ServiceUnavailable() => Problems.Create(StatusCodes.Status503ServiceUnavailable,
        "analytics.unavailable", "Аналітика тимчасово недоступна", "Спробуйте оновити звіт за кілька хвилин.");

    private static string? NullIfBlank(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}

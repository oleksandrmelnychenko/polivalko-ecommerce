using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using PoliValko.Catalog.Persistence;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Security.Permissions;
using PoliValko.Infrastructure.Settings;
using PoliValko.Infrastructure.Storefront;
using PoliValko.SharedKernel;

namespace PoliValko.Catalog.Features.Storefront;

public sealed record StorefrontModeDto(string Mode, DateOnly? Through, Guid Revision, Guid[]? PinnedProductIds = null);
public sealed record ChangeStorefrontMode(string Mode, DateOnly? Through, Guid ExpectedRevision, Guid[]? PinnedProductIds = null);

/// <summary>A product of the preview with its season on the day looked at and what decided it.</summary>
/// <param name="Season">in_season | all_year | off_season</param>
/// <param name="Source">rule | product | category | department | none</param>
public sealed record StorefrontPreviewItemDto(ProductListItemDto Product, string Season, string Source);
public sealed record StorefrontPreviewCountsDto(int InSeason, int AllYear, int OffSeason);
public sealed record StorefrontPreviewDto(IReadOnlyList<StorefrontPreviewItemDto> Items, StorefrontPreviewCountsDto Counts,
    IReadOnlyList<string> RulesWithoutCategory);

internal static class StorefrontMode
{
    private const string Key = "catalog.storefront_mode";
    private static readonly StorefrontModeDto Default = new(ProductSort.Seasonal, null, Guid.Empty);

    public static async Task<StorefrontModeDto> CurrentAsync(PoliValkoDbContext db, DateOnly today, CancellationToken ct)
    {
        var value = await db.Set<PlatformSetting>().Where(s => s.Key == Key).Select(s => s.Value).SingleOrDefaultAsync(ct);
        if (value is null) return Default;
        var saved = JsonSerializer.Deserialize<StorefrontModeDto>(value, JsonSerializerOptions.Web)!;
        return saved.Through < today ? saved with { Mode = ProductSort.Seasonal, Through = null } : saved;
    }

    public static void MapConsole(RouteGroupBuilder catalog)
    {
        var group = catalog.MapGroup("/storefront-mode").RequireStaff(PermissionKeys.CollectionsManage);
        group.MapGet("", Read).WithName("ConsoleStorefrontMode");
        group.MapGet("/preview", Preview).WithName("PreviewStorefrontMode");
        group.MapPut("", Save).WithName("SetStorefrontMode");
    }

    public static Task<StorefrontModeDto> Read(HttpResponse response, PoliValkoDbContext db, TimeProvider time, CancellationToken ct)
    {
        response.Headers.CacheControl = "no-store";
        return CurrentAsync(db, KyivTime.Today(time), ct);
    }

    private const int PreviewSize = 48;

    private static async Task<Results<Ok<StorefrontPreviewDto>, BadRequest>> Preview(string mode, int? month,
        [Microsoft.AspNetCore.Mvc.FromQuery] Guid[]? pinned, string? q, HttpResponse response,
        PoliValkoDbContext db, SeasonalMerchandising merchandising, IMemoryCache cache, TimeProvider time, CancellationToken ct)
    {
        if (!ProductSort.IsMode(mode) || pinned is { Length: > 12 } ||
            month is < 1 or > 12 || (month.HasValue && mode != ProductSort.Seasonal) ||
            q is { Length: > 128 } || q?.Any(char.IsControl) == true) return TypedResults.BadRequest();
        response.Headers.CacheControl = "private, no-store";
        var categories = await CategoryQueries.LoadVisibleCategoriesAsync(db, ct);
        var products = CatalogVisibility.Products(db, categories.Select(c => c.Id).ToArray());
        var today = KyivTime.Today(time);
        var seasonDate = month is { } selected && selected != today.Month
            ? new DateOnly(today.Year + (selected < today.Month ? 1 : 0), selected, 15)
            : today;
        // A name or an article looks one product up; the pins belong to the catalog as a whole.
        var term = string.IsNullOrWhiteSpace(q) ? null : q.Trim();
        var listed = term is null ? products : ProductSearchText.Matching(products, term, ProductSearchText.Words(term));
        var ranked = await merchandising.SortAsync(listed, categories, term, db, today, ct, mode,
            pinned: term is null ? pinned : null, seasonDate: seasonDate);
        var rows = await ProductListing.ListItems(ranked.Take(PreviewSize)).ToListAsync(ct);
        var items = await ProductListing.ToListItemsAsync(db, rows, time, ct);
        var seasons = await SeasonClassifier.QueryAsync(products, categories, db, cache, today, seasonDate, ct);
        var shown = items.Select(item => item.Id).ToArray();
        var states = await seasons.Where(row => shown.Contains(row.ProductId)).ToDictionaryAsync(row => row.ProductId, ct);
        var counts = await seasons.GroupBy(row => row.State).Select(group => new { State = group.Key, Count = group.Count() })
            .ToDictionaryAsync(group => group.State, group => group.Count, ct);
        return TypedResults.Ok(new StorefrontPreviewDto(
            items.Select(item => new StorefrontPreviewItemDto(item, SeasonClassifier.Name(states[item.Id].State),
                SeasonClassifier.Source(states[item.Id]))).ToList(),
            new StorefrontPreviewCountsDto(counts.GetValueOrDefault((int)Season.In), counts.GetValueOrDefault((int)Season.AllYear),
                counts.GetValueOrDefault((int)Season.Off)),
            SeasonalPurpose.RulesWithoutCategory(categories)));
    }

    private static async Task<Results<Ok<StorefrontModeDto>, ValidationProblem, Conflict>> Save(
        ChangeStorefrontMode input, HttpContext http, PoliValkoDbContext db, ISettingsStore settings,
        IAuditLog audit, IStorefrontCache storefront, TimeProvider time, CancellationToken ct)
    {
        var today = KyivTime.Today(time);
        if (!ProductSort.IsMode(input.Mode) || input.Through < today || (input.Mode == ProductSort.Seasonal && input.Through.HasValue))
            return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["mode"] = ["Перевірте режим і дату його завершення."] });

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await db.Database.ExecuteSqlAsync($"SELECT pg_advisory_xact_lock(hashtextextended({Key},0))", ct);
        var before = await CurrentAsync(db, today, ct);
        if (before.Revision != input.ExpectedRevision) return TypedResults.Conflict();
        var pins = input.PinnedProductIds ?? before.PinnedProductIds;
        if (pins is { Length: > 0 })
        {
            var categories = await CategoryQueries.LoadVisibleCategoriesAsync(db, ct);
            var visible = CatalogVisibility.Products(db, categories.Select(c => c.Id).ToArray());
            if (pins.Length > 12 || await visible.CountAsync(p => pins.Contains(p.Id), ct) != pins.Length)
                return TypedResults.ValidationProblem(new Dictionary<string, string[]> {
                    ["pinnedProductIds"] = ["Оберіть до 12 різних опублікованих товарів."] });
        }
        var next = new StorefrontModeDto(input.Mode, input.Through, Guid.NewGuid(), pins is { Length: > 0 } ? pins : null);
        audit.Record("catalog.storefront_mode_changed", "Storefront", Key, new { before, after = next });
        await settings.SaveAsync(Key, next, http.User.StaffName(), ct);
        await tx.CommitAsync(ct);
        await storefront.InvalidateAsync([StorefrontTags.Catalog, StorefrontTags.Products, StorefrontTags.Collections], ct);
        return TypedResults.Ok(next);
    }
}

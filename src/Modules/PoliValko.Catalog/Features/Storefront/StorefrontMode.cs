using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
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

    private static async Task<Results<Ok<List<ProductListItemDto>>, BadRequest>> Preview(string mode,
        [Microsoft.AspNetCore.Mvc.FromQuery] Guid[]? pinned, HttpResponse response,
        PoliValkoDbContext db, SeasonalMerchandising merchandising, TimeProvider time, CancellationToken ct)
    {
        if (!ProductSort.IsMode(mode) || pinned is { Length: > 12 }) return TypedResults.BadRequest();
        response.Headers.CacheControl = "private, no-store";
        var categories = await CategoryQueries.LoadVisibleCategoriesAsync(db, ct);
        var products = CatalogVisibility.Products(db, categories.Select(c => c.Id).ToArray());
        var ranked = await merchandising.SortAsync(products, categories, null, db, KyivTime.Today(time), ct, mode, pinned: pinned);
        var rows = await ProductListing.ListItems(ranked.Take(12)).ToListAsync(ct);
        return TypedResults.Ok(await ProductListing.ToListItemsAsync(db, rows, time, ct));
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

using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Content.Domain;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Storefront;

namespace PoliValko.Content.Features.Site;

internal static class ReorderBanners
{
    public static async Task<Results<Ok<List<BannerDto>>, ValidationProblem>> HandleAsync(
        ReorderBannersRequest request,
        PoliValkoDbContext db,
        ActiveBanners active,
        IAuditLog audit,
        IStorefrontCache storefront,
        TimeProvider time,
        CancellationToken ct)
    {
        var ids = request.Ids ?? [];
        var banners = await db.Set<Banner>().ToListAsync(ct);
        if (ids.Distinct().Count() != ids.Count || ids.Count != banners.Count || banners.Any(b => !ids.Contains(b.Id)))
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]>
            {
                ["ids"] = ["Передайте всі банери в новому порядку, кожен один раз."],
            });
        }

        var now = time.GetUtcNow();
        var byId = banners.ToDictionary(b => b.Id);
        var changed = false;
        for (var i = 0; i < ids.Count; i++)
        {
            var banner = byId[ids[i]];
            if (banner.SortOrder != i + 1)
            {
                banner.SortOrder = i + 1;
                banner.UpdatedAt = now;
                changed = true;
            }
        }

        if (changed)
        {
            audit.Record("site.banners_reordered", "Banner", null, new { ids });
            await db.SaveChangesAsync(ct);
            active.Invalidate();
            await storefront.InvalidateAsync(BannerEditor.StorefrontTagsToInvalidate, ct);
        }

        return TypedResults.Ok(await ListBanners.LoadAsync(db, ct));
    }
}

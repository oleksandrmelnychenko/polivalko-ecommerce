using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Content.Domain;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Storefront;

namespace PoliValko.Content.Features.Site;

internal static class CreateBanner
{
    public static async Task<Results<Created<BannerDto>, ValidationProblem>> HandleAsync(
        SaveBannerRequest request,
        PoliValkoDbContext db,
        ActiveBanners active,
        IAuditLog audit,
        IStorefrontCache storefront,
        TimeProvider time,
        CancellationToken ct)
    {
        var now = time.GetUtcNow();
        var banner = new Banner { Id = Guid.CreateVersion7(now), Title = string.Empty, ImageUrl = string.Empty };
        var errors = BannerEditor.Apply(banner, request);
        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var last = await db.Set<Banner>().MaxAsync(b => (int?)b.SortOrder, ct);
        banner.SortOrder = (last ?? 0) + 1;
        banner.UpdatedAt = now;
        db.Add(banner);
        audit.Record("site.banner_created", "Banner", banner.Id.ToString(), BannerEditor.Snapshot(banner));
        await db.SaveChangesAsync(ct);
        active.Invalidate();
        await storefront.InvalidateAsync(BannerEditor.StorefrontTagsToInvalidate, ct);
        return TypedResults.Created($"/api/v1/console/site/banners/{banner.Id}", BannerEditor.ToDto(banner));
    }
}

using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Content.Domain;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Storefront;

namespace PoliValko.Content.Features.Site;

internal static class UpdateBanner
{
    public static async Task<Results<Ok<BannerDto>, ValidationProblem, ProblemHttpResult>> HandleAsync(
        Guid id,
        SaveBannerRequest request,
        PoliValkoDbContext db,
        ActiveBanners active,
        IAuditLog audit,
        IStorefrontCache storefront,
        TimeProvider time,
        CancellationToken ct)
    {
        var banner = await db.Set<Banner>().FirstOrDefaultAsync(b => b.Id == id, ct);
        if (banner is null)
        {
            return BannerEditor.NotFound();
        }

        var before = BannerEditor.Snapshot(banner);
        var errors = BannerEditor.Apply(banner, request);
        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        banner.UpdatedAt = time.GetUtcNow();
        audit.Record("site.banner_updated", "Banner", banner.Id.ToString(), new { before, after = BannerEditor.Snapshot(banner) });
        await db.SaveChangesAsync(ct);
        active.Invalidate();
        await storefront.InvalidateAsync(BannerEditor.StorefrontTagsToInvalidate, ct);
        return TypedResults.Ok(BannerEditor.ToDto(banner));
    }
}

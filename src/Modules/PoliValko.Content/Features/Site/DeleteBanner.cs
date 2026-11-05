using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Content.Domain;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Storefront;

namespace PoliValko.Content.Features.Site;

internal static class DeleteBanner
{
    public static async Task<Results<NoContent, ProblemHttpResult>> HandleAsync(
        Guid id,
        PoliValkoDbContext db,
        ActiveBanners active,
        IAuditLog audit,
        IStorefrontCache storefront,
        CancellationToken ct)
    {
        var banner = await db.Set<Banner>().FirstOrDefaultAsync(b => b.Id == id, ct);
        if (banner is null)
        {
            return BannerEditor.NotFound();
        }

        db.Remove(banner);
        audit.Record("site.banner_deleted", "Banner", banner.Id.ToString(), BannerEditor.Snapshot(banner));
        await db.SaveChangesAsync(ct);
        active.Invalidate();
        await storefront.InvalidateAsync(BannerEditor.StorefrontTagsToInvalidate, ct);
        return TypedResults.NoContent();
    }
}

using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Domain;
using PoliValko.Catalog.Persistence;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Catalog.Features.Storefront;

internal static class GetPhotoCredits
{
    public static async Task<Ok<List<PhotoCreditDto>>> HandleAsync(PoliValkoDbContext db, CancellationToken ct)
    {
        var visibleProducts = await CatalogVisibility.ProductsAsync(db, ct);
        var credits = await visibleProducts
            .AsNoTracking()
            .Where(p => p.IsVisible)
            .SelectMany(p => p.Images)
            .Where(i => i.Credit != null)
            .Select(i => new { Credit = i.Credit!, i.Url })
            .Distinct()
            .OrderBy(c => c.Credit)
            .ToListAsync(ct);

        return TypedResults.Ok(credits.Select(c => new PhotoCreditDto(c.Credit, c.Url)).ToList());
    }
}

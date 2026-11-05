using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Domain;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Catalog.Features.Console.Brands;

internal static class ListBrands
{
    public static async Task<Ok<List<BrandDto>>> HandleAsync(PoliValkoDbContext db, CancellationToken ct)
    {
        var brands = await db.Set<Brand>().AsNoTracking().OrderBy(b => b.Name).ToListAsync(ct);
        var counts = await BrandEditor.CountProductsAsync(db, ct);
        return TypedResults.Ok(brands.Select(b => BrandEditor.ToDto(b, counts.GetValueOrDefault(b.NormalizedName))).ToList());
    }
}

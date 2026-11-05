using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Domain;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Catalog.Features.Console.Products;

internal static class CountProducts
{
    public static async Task<Ok<ConsoleProductCountsDto>> HandleAsync(PoliValkoDbContext db, TimeProvider time, CancellationToken ct)
    {
        var products = db.Set<Product>().AsNoTracking();
        return TypedResults.Ok(new ConsoleProductCountsDto(
            await products.CountAsync(ct),
            await products.NeedsFilling().CountAsync(ct),
            await products.CreatedSince(time.GetUtcNow(), ProductFillFilters.RecentDays).CountAsync(ct),
            await products.HiddenWithStock().CountAsync(ct),
            await products.CountAsync(p => p.Stock.Quantity <= 0, ct)));
    }
}

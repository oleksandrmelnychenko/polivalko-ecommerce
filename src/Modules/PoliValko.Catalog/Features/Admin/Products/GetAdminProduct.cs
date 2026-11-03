using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Catalog.Features.Admin.Products;

internal static class GetAdminProduct
{
    public static async Task<Results<Ok<AdminProductDto>, ProblemHttpResult>> HandleAsync(Guid id, PoliValkoDbContext db, CancellationToken ct)
    {
        var product = await AdminProductQueries.LoadProductAsync(db, id, tracking: false, ct);
        return product is null ? AdminProductQueries.ProductNotFound() : TypedResults.Ok(AdminProductQueries.ToDto(product));
    }
}

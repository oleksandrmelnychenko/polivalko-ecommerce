using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Catalog.Features.Console.Products;

internal static class GetConsoleProduct
{
    public static async Task<Results<Ok<ConsoleProductDto>, ProblemHttpResult>> HandleAsync(Guid id, PoliValkoDbContext db, CancellationToken ct)
    {
        var product = await ConsoleProductQueries.LoadProductAsync(db, id, tracking: false, ct);
        return product is null ? ConsoleProductQueries.ProductNotFound() : TypedResults.Ok(ConsoleProductQueries.ToDto(product));
    }
}

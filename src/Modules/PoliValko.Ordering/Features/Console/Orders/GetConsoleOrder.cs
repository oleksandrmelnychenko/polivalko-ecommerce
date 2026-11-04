using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Ordering.Persistence;

namespace PoliValko.Ordering.Features.Console.Orders;

internal static class GetConsoleOrder
{
    public static async Task<Results<Ok<ConsoleOrderDto>, ProblemHttpResult>> HandleAsync(string number, PoliValkoDbContext db, CancellationToken ct)
    {
        var order = await OrderLoader.LoadAsync(db, number, tracking: false, ct);
        return order is null ? ConsoleOrderMapping.NotFound(number) : TypedResults.Ok(ConsoleOrderMapping.ToDto(order));
    }
}

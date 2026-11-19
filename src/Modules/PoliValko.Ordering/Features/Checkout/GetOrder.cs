using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Ordering.Contracts;
using PoliValko.Ordering.Persistence;

namespace PoliValko.Ordering.Features.Checkout;

internal static class GetOrder
{
    public static async Task<Results<Ok<OrderDto>, ProblemHttpResult>> HandleAsync(
        string number,
        string? token,
        HttpContext http,
        PoliValkoDbContext db,
        CancellationToken ct)
    {
        http.Response.Headers.CacheControl = "no-store";
        if (!await OrderLoader.MatchesAccessTokenAsync(db, number, token, ct))
        {
            return OrderProblems.NotFound();
        }

        var order = await OrderLoader.LoadAsync(db, number, tracking: false, ct);
        if (order is null)
        {
            return OrderProblems.NotFound();
        }

        return TypedResults.Ok(OrderMapping.ToDto(order));
    }
}

using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Ordering.Contracts;
using PoliValko.Ordering.Domain;
using PoliValko.Ordering.Persistence;

namespace PoliValko.Ordering.Features.Checkout;

internal static class GetOrder
{
    public static async Task<Results<Ok<OrderDto>, ProblemHttpResult>> HandleAsync(
        string number,
        string? token,
        PoliValkoDbContext db,
        CancellationToken ct)
    {
        var order = await OrderLoader.LoadAsync(db, number, tracking: false, ct);
        if (order is null || !OrderTokens.Matches(token, order.AccessTokenHash))
        {
            return OrderProblems.NotFound();
        }

        return TypedResults.Ok(OrderMapping.ToDto(order));
    }
}

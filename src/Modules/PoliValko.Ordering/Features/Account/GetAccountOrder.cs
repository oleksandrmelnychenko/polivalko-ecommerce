using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using PoliValko.Customers.Contracts;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Ordering.Contracts;
using PoliValko.Ordering.Features.Checkout;
using PoliValko.Ordering.Persistence;

namespace PoliValko.Ordering.Features.Account;

internal static class GetAccountOrder
{
    public static async Task<Results<Ok<OrderDto>, ProblemHttpResult>> HandleAsync(
        string number,
        HttpContext http,
        PoliValkoDbContext db,
        CancellationToken ct)
    {
        var customerId = http.User.CustomerId();
        var order = await OrderLoader.LoadAsync(db, number, tracking: false, ct);
        if (order is null || customerId is null || order.CustomerId != customerId)
        {
            return OrderProblems.NotFound();
        }

        return TypedResults.Ok(OrderMapping.ToDto(order));
    }
}

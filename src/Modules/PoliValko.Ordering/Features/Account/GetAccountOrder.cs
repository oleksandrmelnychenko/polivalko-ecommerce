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
        http.Response.Headers.CacheControl = "no-store";
        if (http.User.CustomerId() is not { } customerId)
        {
            return OrderProblems.NotFound();
        }

        var order = await OrderLoader.LoadAsync(db, number, tracking: false, ct, customerId);
        if (order is null)
        {
            return OrderProblems.NotFound();
        }

        return TypedResults.Ok(OrderMapping.ToDto(order));
    }
}

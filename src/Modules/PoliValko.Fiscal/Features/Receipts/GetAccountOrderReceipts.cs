using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using PoliValko.Customers.Contracts;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Ordering.Contracts;

namespace PoliValko.Fiscal.Features.Receipts;

internal static class GetAccountOrderReceipts
{
    public static async Task<Results<Ok<List<ReceiptDto>>, ProblemHttpResult>> HandleAsync(
        string number,
        HttpContext http,
        PoliValkoDbContext db,
        [FromServices] IOrderReceiptSource orders,
        CancellationToken ct)
    {
        if (http.User.CustomerId() is not { } customerId || !await orders.BelongsToCustomerAsync(number, customerId, ct))
        {
            return OrderProblems.NotFound();
        }

        return TypedResults.Ok(await ReceiptQueries.ListAsync(db, number, issuedOnly: true, ct));
    }
}

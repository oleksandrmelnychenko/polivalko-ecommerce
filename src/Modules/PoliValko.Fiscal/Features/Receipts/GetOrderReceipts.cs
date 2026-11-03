using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Ordering.Contracts;

namespace PoliValko.Fiscal.Features.Receipts;

internal static class GetOrderReceipts
{
    public static async Task<Results<Ok<List<ReceiptDto>>, ProblemHttpResult>> HandleAsync(
        string number,
        string? token,
        PoliValkoDbContext db,
        [FromServices] IOrderReceiptSource orders,
        CancellationToken ct)
    {
        if (!await orders.IsAccessibleAsync(number, token, ct))
        {
            return OrderProblems.NotFound();
        }

        return TypedResults.Ok(await ReceiptQueries.ListAsync(db, number, issuedOnly: true, ct));
    }
}

using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Fiscal.Features.Receipts;

internal static class ListOrderReceipts
{
    public static async Task<Ok<List<ReceiptDto>>> HandleAsync(string number, PoliValkoDbContext db, CancellationToken ct) =>
        TypedResults.Ok(await ReceiptQueries.ListAsync(db, number, issuedOnly: false, ct));
}

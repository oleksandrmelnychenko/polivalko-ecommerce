using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using PoliValko.Delivery.Contracts;

namespace PoliValko.Delivery.Features.Storefront;

internal static class SearchSettlements
{
    public static async Task<Ok<List<SettlementDto>>> HandleAsync(string? q, IDeliveryDirectory directory, CancellationToken ct)
    {
        var settlements = await directory.SearchSettlementsAsync(q, 20, ct);
        return TypedResults.Ok(settlements.Select(s => new SettlementDto(s.Ref, s.Name, s.Area)).ToList());
    }
}

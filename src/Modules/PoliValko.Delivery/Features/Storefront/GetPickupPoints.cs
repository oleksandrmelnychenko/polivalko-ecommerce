using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using PoliValko.Delivery.Features.Directory;

namespace PoliValko.Delivery.Features.Storefront;

internal static class GetPickupPoints
{
    public static async Task<Ok<List<PickupPointDto>>> HandleAsync(PickupPointStore store, CancellationToken ct)
    {
        var points = await store.GetActiveAsync(ct);
        return TypedResults.Ok(points.Select(p => new PickupPointDto(p.Code, p.Name, p.Address, p.Schedule, p.Instructions, p.MapUrl)).ToList());
    }
}

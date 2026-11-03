using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Delivery.Domain;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Delivery.Features.Admin;

internal static class ListPickupPoints
{
    public static async Task<Ok<List<AdminPickupPointDto>>> HandleAsync(PoliValkoDbContext db, CancellationToken ct)
    {
        var points = await db.Set<PickupLocation>().AsNoTracking().OrderBy(p => p.Code).ToListAsync(ct);
        return TypedResults.Ok(points.Select(AdminPickupPointMapping.ToDto).ToList());
    }
}

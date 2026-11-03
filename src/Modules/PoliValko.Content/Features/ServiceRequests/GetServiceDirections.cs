using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Content.Domain;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Content.Features.ServiceRequests;

internal static class GetServiceDirections
{
    public static async Task<Ok<List<ServiceDirectionDto>>> HandleAsync(PoliValkoDbContext db, CancellationToken ct)
    {
        var content = await db.Set<ServiceDirectionContent>().AsNoTracking().ToDictionaryAsync(d => d.Code, ct);
        return TypedResults.Ok(ServiceDirections.All
            .Where(d => content.GetValueOrDefault(d.Code)?.IsVisible != false)
            .OrderBy(d => content.GetValueOrDefault(d.Code)?.SortOrder ?? int.MaxValue)
            .Select(d => new ServiceDirectionDto(d.Code, d.Name, content.GetValueOrDefault(d.Code)?.Description))
            .ToList());
    }
}

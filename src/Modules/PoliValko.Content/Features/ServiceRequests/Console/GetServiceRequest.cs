using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Content.Domain;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Web;

namespace PoliValko.Content.Features.ServiceRequests.Console;

internal static class GetServiceRequest
{
    public static async Task<Results<Ok<ConsoleServiceRequestDto>, ProblemHttpResult>> HandleAsync(
        Guid id, PoliValkoDbContext db, CancellationToken ct)
    {
        var entity = await db.Set<ServiceRequest>().AsNoTracking().SingleOrDefaultAsync(row => row.Id == id, ct);
        return entity is null
            ? Problems.NotFound("content.service_request_not_found", "Заявку не знайдено")
            : TypedResults.Ok(ConsoleServiceRequestMapping.ToDto(entity));
    }
}

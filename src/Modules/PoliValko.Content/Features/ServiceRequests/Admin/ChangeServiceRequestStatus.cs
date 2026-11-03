using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Content.Domain;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Web;

namespace PoliValko.Content.Features.ServiceRequests.Admin;

internal static class ChangeServiceRequestStatus
{
    public static async Task<Results<Ok<AdminServiceRequestDto>, ValidationProblem, ProblemHttpResult>> HandleAsync(
        Guid id,
        ChangeServiceRequestStatusRequest request,
        PoliValkoDbContext db,
        CancellationToken ct)
    {
        if (request.Status is not { } status)
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["status"] = ["Оберіть статус."] });
        }

        var entity = await db.Set<ServiceRequest>().FirstOrDefaultAsync(r => r.Id == id, ct);
        if (entity is null)
        {
            return Problems.NotFound("content.service_request_not_found", "Заявку не знайдено");
        }

        entity.Status = status;
        await db.SaveChangesAsync(ct);
        return TypedResults.Ok(AdminServiceRequestMapping.ToDto(entity));
    }
}

using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Content.Domain;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Web;
using PoliValko.SharedKernel;

namespace PoliValko.Content.Features.ServiceRequests.Console;

internal static class ListServiceRequests
{
    public static async Task<Results<Ok<PagedResponse<ConsoleServiceRequestDto>>, ValidationProblem>> HandleAsync(
        [AsParameters] ConsoleServiceRequestQuery query,
        PoliValkoDbContext db,
        CancellationToken ct)
    {
        if (!QueryEnum.TryParse<ServiceRequestStatus>(query.Status, out var status))
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]>
            {
                ["status"] = [$"Допустимі значення: {QueryEnum.Allowed<ServiceRequestStatus>()}."],
            });
        }

        var requests = db.Set<ServiceRequest>().AsNoTracking();
        if (status is { } wanted)
        {
            requests = requests.Where(r => r.Status == wanted);
        }

        var page = PageRequest.From(query.Page, query.PageSize);
        var total = await requests.CountAsync(ct);
        var rows = await requests.OrderByDescending(r => r.CreatedAt).Skip(page.Skip).Take(page.PageSize).ToListAsync(ct);

        return TypedResults.Ok(PagedResponse<ConsoleServiceRequestDto>.Create(rows.Select(ConsoleServiceRequestMapping.ToDto).ToList(), page, total));
    }
}

using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using PoliValko.Content.Domain;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Web;
using PoliValko.SharedKernel;

namespace PoliValko.Content.Api;

public sealed record AdminServiceRequestDto(
    Guid Id,
    DateTimeOffset CreatedAt,
    string Name,
    string Phone,
    string DirectionCode,
    string DirectionName,
    string? Comment,
    ServiceRequestStatus Status);

public sealed record ChangeServiceRequestStatusRequest(ServiceRequestStatus? Status);

public sealed record AdminServiceRequestQuery(
    [FromQuery(Name = "status")] string? Status,
    [FromQuery(Name = "page")] int? Page,
    [FromQuery(Name = "pageSize")] int? PageSize);

public static class AdminServiceRequestEndpoints
{
    public static RouteGroupBuilder MapAdminServiceRequestEndpoints(this RouteGroupBuilder admin)
    {
        var group = admin.MapGroup("/service-requests").WithTags("Admin").RequireStaff();

        group.MapGet(string.Empty, ListAsync)
            .WithName("AdminListServiceRequests")
            .WithEnumQuery<ServiceRequestStatus>("status")
            .WithSummary("Заявки на послуги");

        group.MapPost("/{id:guid}/status", ChangeStatusAsync)
            .WithName("AdminChangeServiceRequestStatus")
            .WithSummary("Статус заявки: нова, в роботі, виконана")
            .ProducesProblem(StatusCodes.Status404NotFound);

        return admin;
    }

    private static async Task<Results<Ok<PagedResponse<AdminServiceRequestDto>>, ValidationProblem>> ListAsync(
        [AsParameters] AdminServiceRequestQuery query,
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

        return TypedResults.Ok(PagedResponse<AdminServiceRequestDto>.Create(rows.Select(ToDto).ToList(), page, total));
    }

    private static async Task<Results<Ok<AdminServiceRequestDto>, ValidationProblem, ProblemHttpResult>> ChangeStatusAsync(
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
        return TypedResults.Ok(ToDto(entity));
    }

    private static AdminServiceRequestDto ToDto(ServiceRequest r) => new(
        r.Id,
        r.CreatedAt,
        r.Name,
        r.Phone,
        r.DirectionCode,
        ServiceDirections.Find(r.DirectionCode)?.Name ?? r.DirectionCode,
        r.Comment,
        r.Status);
}

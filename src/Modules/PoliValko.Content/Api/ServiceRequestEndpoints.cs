using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using PoliValko.Content.Domain;
using PoliValko.Infrastructure.Idempotency;
using PoliValko.Infrastructure.Outbox;
using PoliValko.Infrastructure.Persistence;
using PoliValko.SharedKernel;

namespace PoliValko.Content.Api;

public sealed record ServiceDirectionDto(string Code, string Name, string? Description);

public sealed record CreateServiceRequest(string? Name, string? Phone, string? Direction, string? Comment);

public sealed record ServiceRequestCreated(Guid Id);

public static class ServiceRequestEndpoints
{
    public const string FormsRateLimitPolicy = "forms";

    public static IEndpointRouteBuilder MapContentEndpoints(this IEndpointRouteBuilder api)
    {
        var group = api.MapGroup(string.Empty).WithTags("Services");

        group.MapGet("/service-directions", async (PoliValkoDbContext db, CancellationToken ct) =>
            {
                var content = await db.Set<ServiceDirectionContent>().AsNoTracking().ToDictionaryAsync(d => d.Code, ct);
                return TypedResults.Ok(ServiceDirections.All
                    .Where(d => content.GetValueOrDefault(d.Code)?.IsVisible != false)
                    .OrderBy(d => content.GetValueOrDefault(d.Code)?.SortOrder ?? int.MaxValue)
                    .Select(d => new ServiceDirectionDto(d.Code, d.Name, content.GetValueOrDefault(d.Code)?.Description))
                    .ToList());
            })
            .WithName("GetServiceDirections")
            .WithSummary("Напрямки послуг");

        group.MapPost("/service-requests", CreateAsync)
            .RequireIdempotency<CreateServiceRequest>()
            .RequireRateLimiting(FormsRateLimitPolicy)
            .WithName("CreateServiceRequest")
            .WithSummary("Заявка на послугу. Зберігається в адмінці, відповідальний отримує повідомлення.")
            .ProducesProblem(StatusCodes.Status409Conflict)
            .ProducesProblem(StatusCodes.Status422UnprocessableEntity)
            .ProducesProblem(StatusCodes.Status429TooManyRequests);

        return api;
    }

    private static async Task<Results<Created<ServiceRequestCreated>, ValidationProblem>> CreateAsync(
        CreateServiceRequest request,
        PoliValkoDbContext db,
        IOutbox outbox,
        TimeProvider time,
        CancellationToken ct)
    {
        var errors = Validate(request, out var phone);
        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var now = time.GetUtcNow();
        var entity = new ServiceRequest
        {
            Id = Guid.CreateVersion7(now),
            Name = request.Name!.Trim(),
            Phone = phone,
            DirectionCode = request.Direction!,
            Comment = string.IsNullOrWhiteSpace(request.Comment) ? null : request.Comment.Trim(),
            Status = ServiceRequestStatus.New,
            CreatedAt = now,
        };

        db.Add(entity);
        outbox.Enqueue(new ServiceRequestSubmitted(entity.Id));
        await db.SaveChangesAsync(ct);

        return TypedResults.Created((string?)null, new ServiceRequestCreated(entity.Id));
    }

    internal static Dictionary<string, string[]> Validate(CreateServiceRequest request, out string phone)
    {
        var errors = new Dictionary<string, string[]>();

        var name = request.Name?.Trim();
        if (string.IsNullOrEmpty(name) || name.Length is < 2 or > 100)
        {
            errors["name"] = ["Вкажіть ім'я (від 2 до 100 символів)."];
        }

        if (!PhoneNumber.TryNormalizeUa(request.Phone, out phone))
        {
            errors["phone"] = ["Вкажіть український номер телефону, наприклад +380 67 123 45 67."];
        }

        if (ServiceDirections.Find(request.Direction) is null)
        {
            errors["direction"] = ["Оберіть напрямок послуги."];
        }

        if (request.Comment is { Length: > 1000 })
        {
            errors["comment"] = ["Коментар має бути не довшим за 1000 символів."];
        }

        return errors;
    }
}

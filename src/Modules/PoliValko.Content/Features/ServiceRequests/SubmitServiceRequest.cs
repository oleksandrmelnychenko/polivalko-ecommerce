using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using PoliValko.Content.Contracts;
using PoliValko.Content.Domain;
using PoliValko.Infrastructure.Outbox;
using PoliValko.Infrastructure.Persistence;
using PoliValko.SharedKernel;

namespace PoliValko.Content.Features.ServiceRequests;

internal static class SubmitServiceRequest
{
    public static async Task<Results<Created<ServiceRequestCreated>, ValidationProblem>> HandleAsync(
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

    public static Dictionary<string, string[]> Validate(CreateServiceRequest request, out string phone)
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

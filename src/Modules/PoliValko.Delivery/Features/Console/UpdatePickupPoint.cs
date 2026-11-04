using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Delivery.Domain;
using PoliValko.Delivery.Features.Directory;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Storefront;
using PoliValko.Infrastructure.Web;

namespace PoliValko.Delivery.Features.Console;

internal static class UpdatePickupPoint
{
    public const string PickupPointUpdatedAction = "delivery.pickup_point_updated";

    public static async Task<Results<Ok<ConsolePickupPointDto>, ValidationProblem, ProblemHttpResult>> HandleAsync(
        string code,
        UpdatePickupPointRequest request,
        PoliValkoDbContext db,
        IAuditLog audit,
        PickupPointStore store,
        IStorefrontCache storefront,
        CancellationToken ct)
    {
        var errors = Validate(request, out var values);
        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var point = await db.Set<PickupLocation>().FirstOrDefaultAsync(p => p.Code == code, ct);
        if (point is null)
        {
            return Problems.NotFound("delivery.pickup_point_not_found", "Точку самовивозу не знайдено", $"Точки «{code}» не існує.");
        }

        if (point.IsActive && !values.IsActive && !await db.Set<PickupLocation>().AnyAsync(p => p.IsActive && p.Code != code, ct))
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]>
            {
                ["isActive"] = ["Має залишитися хоча б одна активна точка самовивозу."],
            });
        }

        var before = Snapshot(point);
        if (before == values)
        {
            return TypedResults.Ok(ConsolePickupPointMapping.ToDto(point));
        }

        point.Name = values.Name;
        point.Address = values.Address;
        point.Schedule = values.Schedule;
        point.Instructions = values.Instructions;
        point.MapUrl = values.MapUrl;
        point.IsActive = values.IsActive;

        audit.Record(PickupPointUpdatedAction, "PickupPoint", point.Code, new { before, after = values });
        await db.SaveChangesAsync(ct);
        store.Invalidate();
        await storefront.InvalidateAsync([StorefrontTags.Delivery], ct);

        return TypedResults.Ok(ConsolePickupPointMapping.ToDto(point));
    }

    public static Dictionary<string, string[]> Validate(UpdatePickupPointRequest request, out PickupPointValues values)
    {
        var errors = new Dictionary<string, string[]>();

        var name = request.Name?.Trim() ?? string.Empty;
        if (name.Length is < 2 or > DeliveryLimits.PickupNameLength)
        {
            errors["name"] = [$"Вкажіть назву точки (від 2 до {DeliveryLimits.PickupNameLength} символів)."];
        }

        var address = Required(errors, "address", request.Address, DeliveryLimits.PickupAddressLength, "Вкажіть адресу");
        var schedule = Required(errors, "schedule", request.Schedule, DeliveryLimits.PickupScheduleLength, "Вкажіть графік роботи");
        var instructions = Required(errors, "instructions", request.Instructions, DeliveryLimits.PickupInstructionsLength, "Вкажіть інструкцію покупцю");

        var mapUrl = string.IsNullOrWhiteSpace(request.MapUrl) ? null : request.MapUrl.Trim();
        if (mapUrl is not null
            && (mapUrl.Length > DeliveryLimits.PickupMapUrlLength
                || !Uri.TryCreate(mapUrl, UriKind.Absolute, out var uri)
                || (uri.Scheme != Uri.UriSchemeHttps && uri.Scheme != Uri.UriSchemeHttp)))
        {
            errors["mapUrl"] = [$"Посилання на карту: адреса http(s):// до {DeliveryLimits.PickupMapUrlLength} символів або порожнє поле."];
        }

        if (request.IsActive is null)
        {
            errors["isActive"] = ["Вкажіть, чи доступна точка для самовивозу."];
        }

        values = new PickupPointValues(name, address, schedule, instructions, mapUrl, request.IsActive ?? false);
        return errors;
    }

    private static string Required(Dictionary<string, string[]> errors, string field, string? value, int max, string message)
    {
        var text = value?.Trim() ?? string.Empty;
        if (text.Length is 0 || text.Length > max)
        {
            errors[field] = [$"{message} (до {max} символів)."];
        }

        return text;
    }

    private static PickupPointValues Snapshot(PickupLocation p) =>
        new(p.Name, p.Address, p.Schedule, p.Instructions, p.MapUrl, p.IsActive);

    internal sealed record PickupPointValues(
        string Name,
        string Address,
        string Schedule,
        string Instructions,
        string? MapUrl,
        bool IsActive);
}

using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using PoliValko.Delivery.NovaPoshta;
using PoliValko.Delivery.Persistence;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Sync;
using PoliValko.Infrastructure.Web;

namespace PoliValko.Delivery;

public sealed record AdminPickupPointDto(
    string Code,
    string Name,
    string Address,
    string Schedule,
    string Instructions,
    string? MapUrl,
    bool IsActive);

/// <summary>Повна заміна полів точки самовивозу. <c>MapUrl</c> порожній — посилання на карту прибрати.</summary>
public sealed record UpdatePickupPointRequest(
    string? Name,
    string? Address,
    string? Schedule,
    string? Instructions,
    string? MapUrl,
    bool? IsActive);

public sealed record NovaPoshtaSyncStateDto(
    DateTimeOffset? LastAttemptAt,
    DateTimeOffset? LastSuccessAt,
    string? LastError,
    int ConsecutiveFailures);

/// <summary>
/// Стан довідника Нової пошти. <c>Mode</c>: <c>demo</c> — без ключа API, вітрина бачить демо-дані;
/// <c>api</c> — вітрина бачить локальну копію. Кількості — активні записи локальної копії.
/// </summary>
public sealed record NovaPoshtaStatusDto(
    string Mode,
    int Settlements,
    int Warehouses,
    int Postomats,
    NovaPoshtaSyncStateDto Sync);

internal static class AdminDeliveryEndpoints
{
    public const string PickupPointUpdatedAction = "delivery.pickup_point_updated";
    public const string DemoMode = "demo";
    public const string ApiMode = "api";

    public static void Map(RouteGroupBuilder admin)
    {
        var group = admin.MapGroup("/delivery").WithTags("Admin").RequireStaff(StaffPolicies.Admin);

        group.MapGet("/pickup-points", ListPickupPointsAsync)
            .WithName("AdminListPickupPoints")
            .WithSummary("Точки самовивозу, разом із вимкненими");

        group.MapPut("/pickup-points/{code}", UpdatePickupPointAsync)
            .WithName("AdminUpdatePickupPoint")
            .WithSummary("Змінити точку самовивозу: адреса, графік роботи, інструкція покупцю")
            .ProducesProblem(StatusCodes.Status404NotFound);

        group.MapGet("/novaposhta", GetNovaPoshtaStatusAsync)
            .WithName("AdminGetNovaPoshtaStatus")
            .WithSummary("Довідник Нової пошти: режим, кількість записів і стан синхронізації");
    }

    private static async Task<Ok<List<AdminPickupPointDto>>> ListPickupPointsAsync(PoliValkoDbContext db, CancellationToken ct)
    {
        var points = await db.Set<PickupLocation>().AsNoTracking().OrderBy(p => p.Code).ToListAsync(ct);
        return TypedResults.Ok(points.Select(ToDto).ToList());
    }

    private static async Task<Results<Ok<AdminPickupPointDto>, ValidationProblem, ProblemHttpResult>> UpdatePickupPointAsync(
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
            return TypedResults.Ok(ToDto(point));
        }

        point.Name = values.Name;
        point.Address = values.Address;
        point.Schedule = values.Schedule;
        point.Instructions = values.Instructions;
        point.MapUrl = values.MapUrl;
        point.IsActive = values.IsActive;

        // Адреса, графік і видимість точки — критичні налаштування: пишемо в аудит до й після.
        audit.Record(PickupPointUpdatedAction, "PickupPoint", point.Code, new { before, after = values });
        await db.SaveChangesAsync(ct);
        store.Invalidate();
        await storefront.InvalidateAsync([StorefrontTags.Delivery], ct);

        return TypedResults.Ok(ToDto(point));
    }

    private static async Task<Ok<NovaPoshtaStatusDto>> GetNovaPoshtaStatusAsync(
        PoliValkoDbContext db,
        IOptions<NovaPoshtaOptions> options,
        CancellationToken ct)
    {
        var settlements = await db.Set<NpSettlement>().CountAsync(s => s.IsActive, ct);
        var warehouses = await db.Set<NpWarehouse>().CountAsync(w => w.IsActive, ct);
        var postomats = await db.Set<NpWarehouse>().CountAsync(w => w.IsActive && w.Type == WarehouseType.Postomat, ct);
        var state = await db.Set<SyncState>().AsNoTracking().FirstOrDefaultAsync(s => s.Job == NovaPoshtaSyncJob.JobName, ct);

        return TypedResults.Ok(new NovaPoshtaStatusDto(
            options.Value.IsConfigured ? ApiMode : DemoMode,
            settlements,
            warehouses,
            postomats,
            new NovaPoshtaSyncStateDto(state?.LastAttemptAt, state?.LastSuccessAt, state?.LastError, state?.ConsecutiveFailures ?? 0)));
    }

    /// <summary>Перевіряє й нормалізує поля (обрізає пробіли, порожнє посилання на карту → null).</summary>
    internal static Dictionary<string, string[]> Validate(UpdatePickupPointRequest request, out PickupPointValues values)
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

    private static AdminPickupPointDto ToDto(PickupLocation p) =>
        new(p.Code, p.Name, p.Address, p.Schedule, p.Instructions, p.MapUrl, p.IsActive);
}

/// <summary>Поля точки самовивозу, які змінює адмін; також знімок «до/після» для аудиту.</summary>
internal sealed record PickupPointValues(
    string Name,
    string Address,
    string Schedule,
    string Instructions,
    string? MapUrl,
    bool IsActive);

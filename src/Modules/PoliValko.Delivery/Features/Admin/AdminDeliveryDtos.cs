namespace PoliValko.Delivery.Features.Admin;

public sealed record AdminPickupPointDto(
    string Code,
    string Name,
    string Address,
    string Schedule,
    string Instructions,
    string? MapUrl,
    bool IsActive);

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

public sealed record NovaPoshtaStatusDto(
    string Mode,
    int Settlements,
    int Warehouses,
    int Postomats,
    NovaPoshtaSyncStateDto Sync);

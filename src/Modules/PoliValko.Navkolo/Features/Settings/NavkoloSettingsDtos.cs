namespace PoliValko.Navkolo.Features.Settings;

public sealed record NavkoloConnectionDto(Guid? Revision, string Mode, bool HasKey, string? StoreId, string? StoreName, DateTimeOffset? VerifiedAt, string Source, int? CancellationStatusId = null, string? CancellationStatusName = null);
public sealed record NavkoloStoreDto(string Id, string Name);
public sealed record CheckNavkoloRequest(string? ApiKey);
public sealed record NavkoloStatusDto(int Id, string Name);
public sealed record CheckNavkoloDto(IReadOnlyList<NavkoloStoreDto> Stores, IReadOnlyList<NavkoloStatusDto> Statuses);
public sealed record SaveNavkoloConnectionRequest(Guid? Revision, bool Enabled, string? ApiKey, bool ClearKey, string? StoreId, int? CancellationStatusId = null);

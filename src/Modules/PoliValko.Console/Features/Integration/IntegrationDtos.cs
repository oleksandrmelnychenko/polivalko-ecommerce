using PoliValko.Infrastructure.Outbox;

namespace PoliValko.Console.Features.Integration;

public sealed record SyncJobDto(
    string Job,
    string Title,
    DateTimeOffset? LastAttemptAt,
    DateTimeOffset? LastSuccessAt,
    string? LastError,
    int ConsecutiveFailures,
    DateTimeOffset? RunRequestedAt);

public sealed record IntegrationStatusDto(
    string NavkoloMode,
    bool CatalogDataFresh,
    IReadOnlyList<SyncJobDto> Jobs,
    int OutboxPending,
    int OutboxFailed);

public sealed record OutboxMessageDto(Guid Id, string Type, DateTimeOffset OccurredAt, OutboxStatus Status, int Attempts, DateTimeOffset NextAttemptAt, string? LastError);

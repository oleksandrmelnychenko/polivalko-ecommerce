using System.Text.Json;
using PoliValko.Infrastructure.Sync;

namespace PoliValko.Navkolo.Contracts;

public sealed record ImportRunDto(
    Guid Id,
    string Job,
    SyncRunStatus Status,
    DateTimeOffset StartedAt,
    DateTimeOffset? FinishedAt,
    string StartedBy,
    string? Summary,
    int ErrorCount,
    IReadOnlyList<SyncError> Errors)
{
    public static ImportRunDto From(SyncRun run) => new(
        run.Id,
        run.Job,
        run.Status,
        run.StartedAt,
        run.FinishedAt,
        run.StartedBy,
        run.Summary,
        run.ErrorCount,
        run.Errors is null ? [] : JsonSerializer.Deserialize<List<SyncError>>(run.Errors, JsonSerializerOptions.Web) ?? []);
}

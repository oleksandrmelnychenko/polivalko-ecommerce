using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using PoliValko.Infrastructure.Outbox;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Infrastructure.Sync;

internal sealed class SyncJournal(
    PoliValkoDbContext db,
    IOutbox outbox,
    TimeProvider time,
    IOptions<SyncOptions> options,
    ILogger<SyncJournal> logger) : ISyncJournal
{
    public const int MaxStoredErrors = 200;

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };

    public async Task<SyncRun> RunAsync(string job, string startedBy, Func<CancellationToken, Task<SyncResult>> body, CancellationToken ct)
    {
        var state = await LoadStateAsync(job, ct);
        var run = new SyncRun
        {
            Id = Guid.CreateVersion7(time.GetUtcNow()),
            Job = job,
            StartedAt = time.GetUtcNow(),
            StartedBy = startedBy,
            Status = SyncRunStatus.Running,
        };
        state.LastAttemptAt = run.StartedAt;
        db.Add(run);
        await db.SaveChangesAsync(ct);

        try
        {
            var result = await body(ct);

            db.ChangeTracker.Clear();
            state = await LoadStateAsync(job, ct);
            run = await db.Set<SyncRun>().SingleAsync(r => r.Id == run.Id, ct);

            run.Status = result.Errors.Count > 0 ? SyncRunStatus.PartiallySucceeded : SyncRunStatus.Succeeded;
            run.Summary = Trim(result.Summary, 1000);
            run.ErrorCount = result.Errors.Count;
            run.Errors = result.Errors.Count > 0 ? JsonSerializer.Serialize(result.Errors.Take(MaxStoredErrors), Json) : null;
            run.FinishedAt = time.GetUtcNow();

            state.LastSuccessAt = run.FinishedAt;
            state.LastError = null;
            state.ConsecutiveFailures = 0;
            if (state.AlertedAt is not null)
            {
                outbox.Enqueue(new IntegrationAlert($"Відновлено: {job}", $"Завдання знову виконується успішно. {run.Summary}"));
                state.AlertedAt = null;
            }
        }
        catch (Exception ex) when (!ct.IsCancellationRequested)
        {
            logger.LogWarning(ex, "Фонове завдання {Job} завершилося з помилкою", job);

            db.ChangeTracker.Clear();
            state = await LoadStateAsync(job, CancellationToken.None);
            run = await db.Set<SyncRun>().SingleAsync(r => r.Id == run.Id, CancellationToken.None);

            run.Status = SyncRunStatus.Failed;
            run.Summary = Trim(ex.Message, 1000);
            run.FinishedAt = time.GetUtcNow();

            state.LastError = Trim(ex.Message, 2000);
            state.ConsecutiveFailures++;
            if (state.ConsecutiveFailures >= options.Value.AlertAfterFailures && state.AlertedAt is null)
            {
                outbox.Enqueue(new IntegrationAlert(
                    $"Збій інтеграції: {job}",
                    $"{state.ConsecutiveFailures} невдалих запусків поспіль. Остання помилка: {state.LastError}"));
                state.AlertedAt = run.FinishedAt;
            }
        }

        await db.SaveChangesAsync(CancellationToken.None);
        return run;
    }

    public async Task RequestRunAsync(string job, CancellationToken ct)
    {
        var state = await LoadStateAsync(job, ct);
        state.RunRequestedAt = time.GetUtcNow();
        await db.SaveChangesAsync(ct);
    }

    private async Task<SyncState> LoadStateAsync(string job, CancellationToken ct)
    {
        var state = await db.Set<SyncState>().FirstOrDefaultAsync(s => s.Job == job, ct);
        if (state is null)
        {
            state = new SyncState { Job = job };
            db.Add(state);
        }

        return state;
    }

    private static string Trim(string value, int max) => value.Length > max ? value[..max] : value;
}

using System.Text.Json;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using PoliValko.Catalog;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Outbox;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Sync;
using PoliValko.Infrastructure.Web;
using PoliValko.Navkolo;
using PoliValko.SharedKernel;

namespace PoliValko.Api;

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

public sealed record AuditEntryDto(Guid Id, DateTimeOffset At, string Actor, string Action, string EntityType, string? EntityId, JsonElement? Details);

public sealed record AuditQuery(
    [FromQuery(Name = "entityType")] string? EntityType,
    [FromQuery(Name = "q")] string? Q,
    [FromQuery(Name = "page")] int? Page,
    [FromQuery(Name = "pageSize")] int? PageSize);

/// <summary>
/// Стан інтеграцій для адмінки (розділ 7, 9 ТЗ): час останньої успішної синхронізації, помилки,
/// запуск поза розкладом, ручний повтор невдалих операцій і журнал змін. Читає кілька модулів, тому живе в хості API.
/// </summary>
internal static class IntegrationAdmin
{
    private static readonly Dictionary<string, string> JobTitles = new(StringComparer.Ordinal)
    {
        [NavkoloJobs.PriceStock] = "Navkolo: ціни й залишки",
        [NavkoloJobs.Catalog] = "Navkolo: каталог",
        [NavkoloJobs.Import] = "Імпорт каталогу з файлу",
        ["novaposhta.directory"] = "Нова пошта: довідник",
        ["payments.reconcile"] = "Звірка оплат",
    };

    public static RouteGroupBuilder MapAdminIntegration(this RouteGroupBuilder admin)
    {
        var staff = admin.MapGroup("/integration").WithTags("Admin").RequireStaff();
        staff.MapGet("/status", GetStatusAsync)
            .WithName("AdminIntegrationStatus")
            .WithSummary("Фонові завдання, свіжість даних каталогу й черга операцій");
        staff.MapGet("/runs", ListRunsAsync)
            .WithName("AdminListSyncRuns")
            .WithSummary("Останні запуски завдань зі звітом помилок");

        var adminOnly = admin.MapGroup("/integration").WithTags("Admin").RequireStaff(StaffPolicies.Admin);
        adminOnly.MapPost("/jobs/{job}/run", RequestRunAsync)
            .WithName("AdminRunSyncJob")
            .WithSummary("Запустити завдання поза розкладом (виконає Worker протягом хвилини)")
            .ProducesProblem(StatusCodes.Status404NotFound);
        adminOnly.MapGet("/outbox", ListOutboxAsync)
            .WithName("AdminListOutbox")
            .WithSummary("Невдалі й відкладені операції черги");
        adminOnly.MapPost("/outbox/{id:guid}/retry", RetryAsync)
            .WithName("AdminRetryOutboxMessage")
            .WithSummary("Ручний повтор невдалої операції")
            .ProducesProblem(StatusCodes.Status404NotFound);

        admin.MapGroup("/audit").WithTags("Admin").RequireStaff(StaffPolicies.Admin)
            .MapGet(string.Empty, ListAuditAsync)
            .WithName("AdminListAudit")
            .WithSummary("Журнал змін: доступи, статуси замовлень, повернення, каталог і налаштування");

        return admin;
    }

    private static async Task<Ok<IntegrationStatusDto>> GetStatusAsync(
        PoliValkoDbContext db,
        ICatalogFreshness freshness,
        IOptions<NavkoloOptions> navkolo,
        CancellationToken ct)
    {
        var states = await db.Set<SyncState>().AsNoTracking().ToDictionaryAsync(s => s.Job, ct);
        var jobs = JobTitles.Keys.Union(states.Keys)
            .Select(job => states.TryGetValue(job, out var s)
                ? new SyncJobDto(job, JobTitles.GetValueOrDefault(job, job), s.LastAttemptAt, s.LastSuccessAt, s.LastError, s.ConsecutiveFailures, s.RunRequestedAt)
                : new SyncJobDto(job, JobTitles.GetValueOrDefault(job, job), null, null, null, 0, null))
            .ToList();
        var outbox = await db.OutboxMessages
            .Where(m => m.Status != OutboxStatus.Processed)
            .GroupBy(m => m.Status)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count, ct);

        return TypedResults.Ok(new IntegrationStatusDto(
            navkolo.Value.Mode,
            await freshness.IsFreshAsync(ct),
            jobs,
            outbox.GetValueOrDefault(OutboxStatus.Pending),
            outbox.GetValueOrDefault(OutboxStatus.Failed)));
    }

    private static async Task<Ok<List<ImportRunDto>>> ListRunsAsync(string? job, PoliValkoDbContext db, CancellationToken ct)
    {
        var runs = db.Set<SyncRun>().AsNoTracking();
        if (!string.IsNullOrWhiteSpace(job))
        {
            runs = runs.Where(r => r.Job == job);
        }

        var rows = await runs.OrderByDescending(r => r.StartedAt).Take(50).ToListAsync(ct);
        return TypedResults.Ok(rows.Select(CatalogImportEndpoints.ToDto).ToList());
    }

    private static async Task<Results<NoContent, ProblemHttpResult>> RequestRunAsync(
        string job,
        ISyncJournal journal,
        IAuditLog audit,
        PoliValkoDbContext db,
        CancellationToken ct)
    {
        if (!JobTitles.ContainsKey(job) || job == NavkoloJobs.Import)
        {
            return Problems.NotFound("integration.job_not_found", "Завдання не знайдено");
        }

        await journal.RequestRunAsync(job, ct);
        audit.Record("integration.job_requested", "SyncJob", job);
        await db.SaveChangesAsync(ct);
        return TypedResults.NoContent();
    }

    private static async Task<Ok<List<OutboxMessageDto>>> ListOutboxAsync(PoliValkoDbContext db, CancellationToken ct) =>
        TypedResults.Ok(await db.OutboxMessages
            .AsNoTracking()
            .Where(m => m.Status == OutboxStatus.Failed || (m.Status == OutboxStatus.Pending && m.Attempts > 0))
            .OrderByDescending(m => m.OccurredAt)
            .Take(100)
            .Select(m => new OutboxMessageDto(m.Id, m.Type, m.OccurredAt, m.Status, m.Attempts, m.NextAttemptAt, m.LastError))
            .ToListAsync(ct));

    private static async Task<Results<NoContent, ProblemHttpResult>> RetryAsync(
        Guid id,
        PoliValkoDbContext db,
        IAuditLog audit,
        TimeProvider time,
        CancellationToken ct)
    {
        var message = await db.OutboxMessages.FirstOrDefaultAsync(m => m.Id == id && m.Status != OutboxStatus.Processed, ct);
        if (message is null)
        {
            return Problems.NotFound("integration.message_not_found", "Операцію не знайдено або її вже виконано");
        }

        message.Status = OutboxStatus.Pending;
        message.Attempts = 0;
        message.NextAttemptAt = time.GetUtcNow();
        message.LockedUntil = null;
        audit.Record("integration.outbox_retried", "OutboxMessage", id.ToString(), new { message.Type });
        await db.SaveChangesAsync(ct);
        return TypedResults.NoContent();
    }

    private static async Task<Ok<PagedResponse<AuditEntryDto>>> ListAuditAsync([AsParameters] AuditQuery query, PoliValkoDbContext db, CancellationToken ct)
    {
        var entries = db.Set<AuditEntry>().AsNoTracking();
        if (!string.IsNullOrWhiteSpace(query.EntityType))
        {
            entries = entries.Where(e => e.EntityType == query.EntityType);
        }

        if (!string.IsNullOrWhiteSpace(query.Q))
        {
            var term = query.Q.Trim();
            entries = entries.Where(e => e.EntityId == term || e.Actor.Contains(term) || e.Action.Contains(term));
        }

        var page = PageRequest.From(query.Page, query.PageSize);
        var total = await entries.CountAsync(ct);
        var rows = await entries.OrderByDescending(e => e.At).Skip(page.Skip).Take(page.PageSize).ToListAsync(ct);
        var items = rows.Select(e => new AuditEntryDto(
                e.Id,
                e.At,
                e.Actor,
                e.Action,
                e.EntityType,
                e.EntityId,
                e.Details is null ? null : JsonDocument.Parse(e.Details).RootElement.Clone()))
            .ToList();
        return TypedResults.Ok(PagedResponse<AuditEntryDto>.Create(items, page, total));
    }
}

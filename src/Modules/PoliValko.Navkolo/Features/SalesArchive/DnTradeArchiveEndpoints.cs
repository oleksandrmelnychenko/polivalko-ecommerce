using System.Text;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Net.Http.Headers;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Security.Permissions;
using PoliValko.Infrastructure.Web;

namespace PoliValko.Navkolo.Features.SalesArchive;

public sealed record DnTradeArchiveItemDto(Guid Id, string SourceAccount, string EntityType, string SourceId, string? SourceDate,
    string? DocumentType, string? OrganizationId, string[] StoreIds, string? Status, string? Currency, decimal? Total);

public sealed record DnTradeArchiveDetailDto(Guid Id, string SourceAccount, string EntityType, string SourceId, string? SourceDate,
    string? DocumentType, string? OrganizationId, string[] StoreIds, string? Status, string? Currency, decimal? Total,
    string? ParentSourceId, DateTimeOffset ImportedAt);

public sealed record DnTradeArchivePageDto(IReadOnlyList<DnTradeArchiveItemDto> Items, int Total, int Page, int PageSize);

public sealed record DnTradeArchiveImportDto(int Inserted, int Unchanged);

internal static class DnTradeArchiveEndpoints
{
    public static RouteGroupBuilder Map(RouteGroupBuilder console)
    {
        var group = console.MapGroup("/dntrade-archive").WithTags("Console").RequireStaff(PermissionKeys.DnTradeArchiveView);
        group.AddEndpointFilter((context, next) =>
        {
            context.HttpContext.Response.Headers.CacheControl = "no-store";
            return next(context);
        });

        group.MapGet("", List).WithName("ConsoleListDnTradeArchive")
            .Produces<DnTradeArchivePageDto>().ProducesValidationProblem();
        group.MapGet("/{id:guid}", Detail).WithName("ConsoleGetDnTradeArchiveRecord")
            .Produces<DnTradeArchiveDetailDto>().ProducesProblem(StatusCodes.Status404NotFound);
        group.MapGet("/{id:guid}/original", Original).WithName("ConsoleDownloadDnTradeArchiveOriginal")
            .RequirePermission(PermissionKeys.DnTradeArchiveOriginal)
            .Produces(StatusCodes.Status200OK, contentType: "application/json").ProducesProblem(StatusCodes.Status404NotFound);
        group.MapPost("/import", Import).WithName("ConsoleImportDnTradeArchive")
            .RequirePermission(PermissionKeys.DnTradeArchiveImport).RequireRateLimiting(RateLimitPolicies.DnTradeArchiveImport)
            .Accepts<string>(DnTradeArchiveInput.ContentType).Produces<DnTradeArchiveImportDto>().ProducesValidationProblem()
            .ProducesProblem(StatusCodes.Status409Conflict).ProducesProblem(StatusCodes.Status413PayloadTooLarge)
            .ProducesProblem(StatusCodes.Status415UnsupportedMediaType).ProducesProblem(StatusCodes.Status429TooManyRequests);
        return console;
    }

    private static async Task<IResult> List(PoliValkoDbContext db, string? sourceAccount, string? entityType, string? storeId,
        DateOnly? from, DateOnly? to, string? q, int page = 1, int pageSize = 50, CancellationToken ct = default)
    {
        if (sourceAccount is not null && !DnTradeArchiveInput.IsAccount(sourceAccount))
            return Invalid("sourceAccount", "Вкажіть ідентифікатор джерела з літер a–z, цифр або дефіса (до 64 символів).");
        if (entityType is not null && !DnTradeArchiveInput.IsEntityType(entityType))
            return Invalid("entityType", "Невідомий тип запису архіву.");
        if (from > to) return Invalid("to", "Кінцева дата має бути не раніше початкової.");
        if (pageSize is < 1 or > 100 || page < 1 || page - 1 > int.MaxValue / pageSize)
            return Invalid("page", "Некоректна сторінка або кількість записів на сторінці.");
        if (storeId is { Length: > 200 } || storeId?.Any(char.IsControl) == true) return Invalid("storeId", "Некоректний склад.");
        if (q is { Length: > 128 } || q?.Any(char.IsControl) == true) return Invalid("q", "Некоректний пошуковий запит.");

        var records = db.Set<DnTradeArchiveRecord>().AsNoTracking();
        if (sourceAccount is not null) records = records.Where(x => x.SourceAccount == sourceAccount);
        if (entityType is not null) records = records.Where(x => x.EntityType == entityType);
        if (!string.IsNullOrWhiteSpace(storeId)) records = records.Where(x => x.StoreIds.Contains(storeId));
        if (from is not null) records = records.Where(x => x.SourceDay >= from);
        if (to is not null) records = records.Where(x => x.SourceDay <= to);
        if (!string.IsNullOrWhiteSpace(q))
        {
            var pattern = "%" + q.Trim().Replace("\\", "\\\\", StringComparison.Ordinal)
                .Replace("%", "\\%", StringComparison.Ordinal).Replace("_", "\\_", StringComparison.Ordinal) + "%";
            records = records.Where(x => EF.Functions.ILike(x.SourceId, pattern, "\\") || EF.Functions.ILike(x.EntityType, pattern, "\\") ||
                (x.DocumentType != null && EF.Functions.ILike(x.DocumentType, pattern, "\\")));
        }

        var total = await records.CountAsync(ct);
        var items = await records.OrderByDescending(x => x.SourceDay.HasValue).ThenByDescending(x => x.SourceDay).ThenBy(x => x.Id)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(x => new DnTradeArchiveItemDto(x.Id, x.SourceAccount, x.EntityType, x.SourceId, x.SourceDate, x.DocumentType,
                x.OrganizationId, x.StoreIds, x.Status, x.Currency, x.Total)).ToListAsync(ct);
        return TypedResults.Ok(new DnTradeArchivePageDto(items, total, page, pageSize));
    }

    private static async Task<IResult> Detail(Guid id, PoliValkoDbContext db, CancellationToken ct)
    {
        var result = await db.Set<DnTradeArchiveRecord>().AsNoTracking().Where(x => x.Id == id)
            .Select(x => new DnTradeArchiveDetailDto(x.Id, x.SourceAccount, x.EntityType, x.SourceId, x.SourceDate, x.DocumentType,
                x.OrganizationId, x.StoreIds, x.Status, x.Currency, x.Total, x.ParentSourceId, x.ImportedAt)).SingleOrDefaultAsync(ct);
        return result is null ? RecordNotFound() : TypedResults.Ok(result);
    }

    private static async Task<IResult> Original(Guid id, PoliValkoDbContext db, CancellationToken ct)
    {
        var payload = await db.Set<DnTradeArchiveRecord>().AsNoTracking().Where(x => x.Id == id)
            .Select(x => x.Payload).SingleOrDefaultAsync(ct);
        return payload is null
            ? RecordNotFound()
            : Results.File(Encoding.UTF8.GetBytes(payload), "application/json", fileDownloadName: $"dntrade-archive-{id:N}.json");
    }

    private static async Task<IResult> Import(string? sourceAccount, HttpRequest request, PoliValkoDbContext db,
        IAuditLog audit, TimeProvider time, CancellationToken ct)
    {
        if (sourceAccount is null || !DnTradeArchiveInput.IsAccount(sourceAccount))
            return Invalid("sourceAccount", "Вкажіть ідентифікатор джерела з літер a–z, цифр або дефіса (до 64 символів).");
        if (!MediaTypeHeaderValue.TryParse(request.ContentType, out var mediaType) ||
            !string.Equals(mediaType.MediaType.Value, DnTradeArchiveInput.ContentType, StringComparison.OrdinalIgnoreCase))
            return Problems.Create(StatusCodes.Status415UnsupportedMediaType, "dntrade.archive_media_type", "Потрібен файл NDJSON у кодуванні UTF-8");
        if (request.ContentLength > DnTradeArchiveInput.MaxBytes) return TooLarge();

        IReadOnlyList<DnTradeArchiveRecord> records;
        try
        {
            records = await DnTradeArchiveInput.ReadAsync(request.Body, sourceAccount, time.GetUtcNow(), ct);
        }
        catch (ArchiveSizeException)
        {
            return TooLarge();
        }
        catch (ArchiveInputException error)
        {
            return Invalid("file", error.Message);
        }

        var batch = new Dictionary<string, DnTradeArchiveRecord>(StringComparer.Ordinal);
        foreach (var record in records)
        {
            var key = Key(record.EntityType, record.SourceId);
            if (batch.TryGetValue(key, out var previous) && previous.Fingerprint != record.Fingerprint) return Conflict();
            batch.TryAdd(key, record);
        }

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var lockKey = $"dntrade.archive:{sourceAccount}";
        await db.Database.ExecuteSqlAsync($"SELECT pg_advisory_xact_lock(hashtextextended({lockKey}, 0))", ct);

        var sourceIds = batch.Values.Select(record => record.SourceId).Distinct(StringComparer.Ordinal).ToArray();
        var existing = await db.Set<DnTradeArchiveRecord>().AsNoTracking()
            .Where(x => x.SourceAccount == sourceAccount && sourceIds.Contains(x.SourceId))
            .Select(x => new { x.EntityType, x.SourceId, x.Fingerprint }).ToListAsync(ct);
        foreach (var item in existing)
        {
            var key = Key(item.EntityType, item.SourceId);
            if (batch.Remove(key, out var incoming) && incoming.Fingerprint != item.Fingerprint) return Conflict();
        }

        var result = new DnTradeArchiveImportDto(batch.Count, records.Count - batch.Count);
        if (result.Inserted == 0) return TypedResults.Ok(result);

        db.Set<DnTradeArchiveRecord>().AddRange(batch.Values);
        audit.Record("dntrade.archive_imported", "DnTradeArchive", sourceAccount, result);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return TypedResults.Ok(result);
    }

    private static string Key(string type, string id) => $"{type}:{id}";

    private static IResult Invalid(string field, string message) => TypedResults.ValidationProblem(new Dictionary<string, string[]> { [field] = [message] });

    private static IResult RecordNotFound() => Problems.NotFound("dntrade.archive_not_found", "Запис архіву не знайдено");

    private static IResult TooLarge() => Problems.Create(StatusCodes.Status413PayloadTooLarge, "dntrade.archive_too_large",
        "Завеликий файл архіву", "Один пакет може містити до 1000 записів і займати до 10 МіБ.");

    private static IResult Conflict() => Problems.Create(StatusCodes.Status409Conflict, "dntrade.archive_conflict",
        "Запис із таким ідентифікатором вже має інші дані", "Пакет не імпортовано.");
}

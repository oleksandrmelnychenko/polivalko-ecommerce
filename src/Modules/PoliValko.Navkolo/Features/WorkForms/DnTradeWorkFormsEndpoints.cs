using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Security.Permissions;
using PoliValko.Infrastructure.Web;
using PoliValko.Navkolo.Features.SalesArchive;

namespace PoliValko.Navkolo.Features.WorkForms;

internal static class DnTradeWorkFormsEndpoints
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public static RouteGroupBuilder Map(RouteGroupBuilder console)
    {
        var group = console.MapGroup("/dntrade-work-forms").WithTags("Console").RequireStaff(PermissionKeys.DnTradeArchiveView);
        group.AddEndpointFilter((context, next) =>
        {
            context.HttpContext.Response.Headers.CacheControl = "no-store";
            return next(context);
        });

        RequireWorkFormAccess(group.MapGet("", List)).WithName("ConsoleListDnTradeWorkForms")
            .Produces<DnTradeWorkFormPageDto>().ProducesValidationProblem();
        RequireWorkFormAccess(group.MapGet("/{id:guid}", Detail)).WithName("ConsoleGetDnTradeWorkForm")
            .Produces<DnTradeWorkFormDto>().ProducesProblem(StatusCodes.Status404NotFound);
        RequireWorkFormAccess(group.MapPut("/{id:guid}", Save)).WithName("ConsoleSaveDnTradeWorkForm")
            .WithMetadata(new RequestSizeLimitAttribute(1024 * 1024))
            .Produces<DnTradeWorkFormDto>().ProducesValidationProblem().ProducesProblem(StatusCodes.Status409Conflict);
        return console;
    }

    private static RouteHandlerBuilder RequireWorkFormAccess(RouteHandlerBuilder route) =>
        route.RequirePermission(PermissionKeys.DnTradeArchiveImport).RequirePermission(PermissionKeys.DnTradeArchiveOriginal);

    private static async Task<IResult> List(PoliValkoDbContext db, string? section, string? status, Guid? sourceRecordId,
        string? q, int page = 1, int pageSize = 25, CancellationToken ct = default)
    {
        if (section is not null && !DnTradeWorkFormValidation.IsSection(section)) return Invalid("section", "Невідомий розділ форми.");
        if (status is not null && !DnTradeWorkFormValidation.IsStatus(status)) return Invalid("status", "Невідомий стан форми.");
        if (sourceRecordId == Guid.Empty) return Invalid("sourceRecordId", "Некоректний запис архіву.");
        if (pageSize is < 1 or > 100 || page < 1 || page - 1 > int.MaxValue / pageSize)
            return Invalid("page", "Некоректна сторінка або кількість записів на сторінці.");
        if (q is { Length: > 128 } || q?.Any(char.IsControl) == true) return Invalid("q", "Некоректний пошуковий запит.");

        var forms = db.Set<DnTradeWorkForm>().AsNoTracking();
        if (section is not null) forms = forms.Where(x => x.Section == section);
        if (status is not null) forms = forms.Where(x => x.Status == status);
        if (sourceRecordId is not null) forms = forms.Where(x => x.SourceRecordId == sourceRecordId);
        if (!string.IsNullOrWhiteSpace(q))
        {
            var pattern = "%" + q.Trim().Replace("\\", "\\\\", StringComparison.Ordinal)
                .Replace("%", "\\%", StringComparison.Ordinal).Replace("_", "\\_", StringComparison.Ordinal) + "%";
            forms = forms.Where(x => EF.Functions.ILike(x.Title, pattern, "\\"));
        }

        var total = await forms.CountAsync(ct);
        var items = await forms.OrderByDescending(x => x.UpdatedAt).ThenBy(x => x.Id).Skip((page - 1) * pageSize).Take(pageSize)
            .Select(x => new DnTradeWorkFormItemDto(x.Id, x.Version, x.Section, x.Type, x.Status,
                x.Title, x.DocumentDate, x.SourceRecordId, x.CreatedAt, x.UpdatedAt)).ToListAsync(ct);
        return TypedResults.Ok(new DnTradeWorkFormPageDto(items, page, pageSize, total));
    }

    private static async Task<IResult> Detail(Guid id, PoliValkoDbContext db, CancellationToken ct)
    {
        var form = await db.Set<DnTradeWorkForm>().AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, ct);
        return form is null ? Problems.NotFound("dntrade.work_form_not_found", "Робочу форму не знайдено") : TypedResults.Ok(ToDto(form));
    }

    private static async Task<IResult> Save(Guid id, SaveDnTradeWorkFormRequest request, PoliValkoDbContext db,
        IAuditLog audit, TimeProvider time, CancellationToken ct)
    {
        if (id == Guid.Empty) return Invalid("id", "Некоректний ідентифікатор форми.");
        var errors = DnTradeWorkFormValidation.Validate(request);
        if (errors.Count > 0) return TypedResults.ValidationProblem(errors);

        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var formKey = $"dntrade.work-form:{id:N}";
        await db.Database.ExecuteSqlAsync($"SELECT pg_advisory_xact_lock(hashtextextended({formKey}, 0))", ct);
        var form = await db.Set<DnTradeWorkForm>().SingleOrDefaultAsync(x => x.Id == id, ct);
        if (request.ExpectedVersion != form?.Version) return VersionConflict();
        if (form?.Status == "archived")
            return Problems.Create(StatusCodes.Status409Conflict, "dntrade.work_form_archived", "Архівовану форму не можна змінити");
        if (form?.Version == int.MaxValue) return VersionConflict();

        if (request.SourceRecordId is { } sourceId && !await db.Set<DnTradeArchiveRecord>().AnyAsync(x => x.Id == sourceId, ct))
            return Invalid("sourceRecordId", "Пов’язаний запис архіву не знайдено.");

        var previousStatus = form?.Status;
        var now = time.GetUtcNow();
        var data = JsonSerializer.Serialize(request.Data, Json);
        if (form is null)
        {
            form = new DnTradeWorkForm
            {
                Id = id, Version = 1, Section = request.Section, Type = request.Type, Status = request.Status, Title = request.Title,
                DocumentDate = request.DocumentDate, SourceRecordId = request.SourceRecordId, CreatedAt = now, UpdatedAt = now, Data = data,
            };
            db.Set<DnTradeWorkForm>().Add(form);
        }
        else
        {
            form.Version++;
            form.Section = request.Section;
            form.Type = request.Type;
            form.Status = request.Status;
            form.Title = request.Title;
            form.DocumentDate = request.DocumentDate;
            form.SourceRecordId = request.SourceRecordId;
            form.UpdatedAt = now;
            form.Data = data;
        }

        audit.Record(previousStatus is null ? "dntrade.work_form_created" : "dntrade.work_form_updated", "DnTradeWorkForm", id.ToString(),
            new { form.Version, form.Section, form.Type, form.Status, form.SourceRecordId, PreviousStatus = previousStatus });
        try
        {
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            return VersionConflict();
        }

        return TypedResults.Ok(ToDto(form));
    }

    private static DnTradeWorkFormDto ToDto(DnTradeWorkForm form) => new(form.Id, form.Version, form.Section, form.Type, form.Status,
        form.Title, form.DocumentDate, form.SourceRecordId, form.CreatedAt, form.UpdatedAt,
        JsonSerializer.Deserialize<DnTradeWorkFormData>(form.Data, Json) ?? throw new InvalidOperationException("Work form data is missing."));

    private static IResult VersionConflict() => Problems.Create(StatusCodes.Status409Conflict, "dntrade.work_form_version_conflict",
        "Робочу форму вже змінено", "Оновіть форму перед збереженням.");

    private static IResult Invalid(string field, string message) => TypedResults.ValidationProblem(new Dictionary<string, string[]> { [field] = [message] });
}

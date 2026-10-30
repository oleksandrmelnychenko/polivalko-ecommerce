using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using PoliValko.Content.Domain;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Web;

namespace PoliValko.Content.Api;

public sealed record PageDto(string Slug, string Title, string? Lead, string? BodyHtml, DateTimeOffset UpdatedAt, string? UpdatedBy);

public sealed record AdminPageListItemDto(string Slug, string Title, DateTimeOffset UpdatedAt, string? UpdatedBy);

public sealed record SavePageRequest(string? Title, string? Lead, string? BodyHtml);

public sealed record ContactsDto(
    string? StorePhone,
    string? ServicesPhone,
    string? Email,
    string? Address,
    string? Schedule,
    string? MapUrl,
    string? Instagram,
    string? Facebook,
    string? Telegram,
    string? YouTube);

public sealed record AdminServiceDirectionDto(string Code, string Name, string? Description, int SortOrder, bool IsVisible);

public sealed record SaveServiceDirectionRequest(string? Description, int SortOrder, bool IsVisible);

/// <summary>Тексти сторінок, контакти й описи послуг: читаються вітриною, редагуються адміністратором (розділ 9 ТЗ).</summary>
public static partial class SiteContentEndpoints
{
    public static IEndpointRouteBuilder MapSiteContentEndpoints(this IEndpointRouteBuilder api)
    {
        var group = api.MapGroup(string.Empty).WithTags("Content");

        group.MapGet("/pages/{slug}", GetPageAsync)
            .WithName("GetPage")
            .WithSummary("Текстова сторінка: оферта, приватність, повернення, доставка й оплата")
            .ProducesProblem(StatusCodes.Status404NotFound);

        group.MapGet("/contacts", GetContactsAsync)
            .WithName("GetContacts")
            .WithSummary("Адреса, графік, телефони магазину й послуг, маршрут і соцмережі");

        return api;
    }

    public static RouteGroupBuilder MapAdminSiteContentEndpoints(this RouteGroupBuilder admin)
    {
        var content = admin.MapGroup("/content").WithTags("Admin").RequireStaff(StaffPolicies.Admin);

        content.MapGet("/pages", async (PoliValkoDbContext db, CancellationToken ct) => TypedResults.Ok(await db.Set<ContentPage>()
                .AsNoTracking()
                .OrderBy(p => p.Title)
                .Select(p => new AdminPageListItemDto(p.Slug, p.Title, p.UpdatedAt, p.UpdatedBy))
                .ToListAsync(ct)))
            .WithName("AdminListPages")
            .WithSummary("Текстові сторінки");
        content.MapGet("/pages/{slug}", GetPageAsync)
            .WithName("AdminGetPage")
            .WithSummary("Текстова сторінка для редагування")
            .ProducesProblem(StatusCodes.Status404NotFound);
        content.MapPut("/pages/{slug}", SavePageAsync)
            .WithName("AdminSavePage")
            .WithSummary("Зміна тексту сторінки; HTML очищається від небезпечної розмітки")
            .ProducesProblem(StatusCodes.Status404NotFound);

        content.MapGet("/contacts", GetContactsAsync)
            .WithName("AdminGetContacts")
            .WithSummary("Контакти магазину");
        content.MapPut("/contacts", SaveContactsAsync)
            .WithName("AdminSaveContacts")
            .WithSummary("Зміна контактів магазину");

        content.MapGet("/services", ListServicesAsync)
            .WithName("AdminListServiceDirections")
            .WithSummary("Напрямки послуг з описами");
        content.MapPut("/services/{code}", SaveServiceAsync)
            .WithName("AdminSaveServiceDirection")
            .WithSummary("Опис, порядок і видимість напрямку послуг")
            .ProducesProblem(StatusCodes.Status404NotFound);

        return admin;
    }

    private static async Task<Results<Ok<PageDto>, ProblemHttpResult>> GetPageAsync(string slug, PoliValkoDbContext db, CancellationToken ct)
    {
        var page = await db.Set<ContentPage>().AsNoTracking().FirstOrDefaultAsync(p => p.Slug == slug, ct);
        return page is null ? PageNotFound() : TypedResults.Ok(ToDto(page));
    }

    private static async Task<Results<Ok<PageDto>, ValidationProblem, ProblemHttpResult>> SavePageAsync(
        string slug,
        SavePageRequest request,
        PoliValkoDbContext db,
        IRichTextSanitizer sanitizer,
        IAuditLog audit,
        IStorefrontCache storefront,
        HttpContext http,
        TimeProvider time,
        CancellationToken ct)
    {
        var page = await db.Set<ContentPage>().FirstOrDefaultAsync(p => p.Slug == slug, ct);
        if (page is null)
        {
            return PageNotFound();
        }

        var errors = new Dictionary<string, string[]>();
        var title = request.Title?.Trim();
        if (string.IsNullOrEmpty(title) || title.Length > 200)
        {
            errors["title"] = ["Вкажіть заголовок до 200 символів."];
        }

        if (request.Lead is { Length: > 500 })
        {
            errors["lead"] = ["Підзаголовок — до 500 символів."];
        }

        var body = sanitizer.Sanitize(request.BodyHtml);
        if (body is { Length: > 100_000 })
        {
            errors["bodyHtml"] = ["Текст завеликий."];
        }

        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        page.Title = title!;
        page.Lead = string.IsNullOrWhiteSpace(request.Lead) ? null : request.Lead.Trim();
        page.BodyHtml = body;
        page.UpdatedAt = time.GetUtcNow();
        page.UpdatedBy = http.User.StaffName();
        audit.Record("content.page_updated", "Page", slug, new { page.Title, length = body?.Length ?? 0 });
        await db.SaveChangesAsync(ct);
        await storefront.InvalidateAsync([StorefrontTags.Content, StorefrontTags.Page(slug)], ct);
        return TypedResults.Ok(ToDto(page));
    }

    private static async Task<Ok<ContactsDto>> GetContactsAsync(PoliValkoDbContext db, CancellationToken ct)
    {
        var contacts = await db.Set<SiteContacts>().AsNoTracking().FirstOrDefaultAsync(c => c.Id == SiteContacts.SingletonId, ct) ?? new SiteContacts();
        return TypedResults.Ok(ToDto(contacts));
    }

    private static async Task<Results<Ok<ContactsDto>, ValidationProblem>> SaveContactsAsync(
        ContactsDto request,
        PoliValkoDbContext db,
        IAuditLog audit,
        IStorefrontCache storefront,
        TimeProvider time,
        CancellationToken ct)
    {
        var errors = new Dictionary<string, string[]>();
        Check(errors, "storePhone", request.StorePhone, 30);
        Check(errors, "servicesPhone", request.ServicesPhone, 30);
        Check(errors, "email", request.Email, 200);
        Check(errors, "address", request.Address, 300);
        Check(errors, "schedule", request.Schedule, 300);
        CheckUrl(errors, "mapUrl", request.MapUrl);
        CheckUrl(errors, "instagram", request.Instagram);
        CheckUrl(errors, "facebook", request.Facebook);
        CheckUrl(errors, "telegram", request.Telegram);
        CheckUrl(errors, "youTube", request.YouTube);
        if (request.Email is { Length: > 0 } email && !EmailPattern().IsMatch(email.Trim()))
        {
            errors["email"] = ["Перевірте email."];
        }

        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var contacts = await db.Set<SiteContacts>().FirstOrDefaultAsync(c => c.Id == SiteContacts.SingletonId, ct);
        if (contacts is null)
        {
            contacts = new SiteContacts();
            db.Add(contacts);
        }

        var before = ToDto(contacts);
        contacts.StorePhone = Clean(request.StorePhone);
        contacts.ServicesPhone = Clean(request.ServicesPhone);
        contacts.Email = Clean(request.Email);
        contacts.Address = Clean(request.Address);
        contacts.Schedule = Clean(request.Schedule);
        contacts.MapUrl = Clean(request.MapUrl);
        contacts.Instagram = Clean(request.Instagram);
        contacts.Facebook = Clean(request.Facebook);
        contacts.Telegram = Clean(request.Telegram);
        contacts.YouTube = Clean(request.YouTube);
        contacts.UpdatedAt = time.GetUtcNow();
        audit.Record("content.contacts_updated", "Contacts", null, new { before, after = ToDto(contacts) });
        await db.SaveChangesAsync(ct);
        await storefront.InvalidateAsync([StorefrontTags.Content], ct);
        return TypedResults.Ok(ToDto(contacts));
    }

    private static async Task<Ok<List<AdminServiceDirectionDto>>> ListServicesAsync(PoliValkoDbContext db, CancellationToken ct)
    {
        var content = await db.Set<ServiceDirectionContent>().AsNoTracking().ToDictionaryAsync(d => d.Code, ct);
        return TypedResults.Ok(ServiceDirections.All
            .Select((d, i) => content.TryGetValue(d.Code, out var c)
                ? new AdminServiceDirectionDto(d.Code, d.Name, c.Description, c.SortOrder, c.IsVisible)
                : new AdminServiceDirectionDto(d.Code, d.Name, null, i + 1, true))
            .OrderBy(d => d.SortOrder)
            .ToList());
    }

    private static async Task<Results<Ok<AdminServiceDirectionDto>, ValidationProblem, ProblemHttpResult>> SaveServiceAsync(
        string code,
        SaveServiceDirectionRequest request,
        PoliValkoDbContext db,
        IAuditLog audit,
        IStorefrontCache storefront,
        CancellationToken ct)
    {
        if (ServiceDirections.Find(code) is not { } direction)
        {
            return Problems.NotFound("content.direction_not_found", "Напрямок не знайдено");
        }

        if (request.Description is { Length: > 1000 })
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["description"] = ["Опис — до 1000 символів."] });
        }

        var content = await db.Set<ServiceDirectionContent>().FirstOrDefaultAsync(d => d.Code == code, ct);
        if (content is null)
        {
            content = new ServiceDirectionContent { Code = code };
            db.Add(content);
        }

        content.Description = Clean(request.Description);
        content.SortOrder = request.SortOrder;
        content.IsVisible = request.IsVisible;
        audit.Record("content.service_direction_updated", "ServiceDirection", code, new { content.IsVisible, content.SortOrder });
        await db.SaveChangesAsync(ct);
        await storefront.InvalidateAsync(["services"], ct);
        return TypedResults.Ok(new AdminServiceDirectionDto(code, direction.Name, content.Description, content.SortOrder, content.IsVisible));
    }

    private static PageDto ToDto(ContentPage p) => new(p.Slug, p.Title, p.Lead, p.BodyHtml, p.UpdatedAt, p.UpdatedBy);

    private static ContactsDto ToDto(SiteContacts c) =>
        new(c.StorePhone, c.ServicesPhone, c.Email, c.Address, c.Schedule, c.MapUrl, c.Instagram, c.Facebook, c.Telegram, c.YouTube);

    private static void Check(Dictionary<string, string[]> errors, string field, string? value, int max)
    {
        if (value is { } v && v.Trim().Length > max)
        {
            errors[field] = [$"Не більше {max} символів."];
        }
    }

    private static void CheckUrl(Dictionary<string, string[]> errors, string field, string? value)
    {
        if (!string.IsNullOrWhiteSpace(value)
            && (value.Trim().Length > 500 || !Uri.TryCreate(value.Trim(), UriKind.Absolute, out var uri) || uri.Scheme is not ("https" or "http")))
        {
            errors[field] = ["Вкажіть повне посилання, що починається з https://."];
        }
    }

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static ProblemHttpResult PageNotFound() => Problems.NotFound("content.page_not_found", "Сторінку не знайдено");

    [GeneratedRegex(@"^[^@\s]+@[^@\s]+\.[^@\s]+$")]
    private static partial Regex EmailPattern();
}

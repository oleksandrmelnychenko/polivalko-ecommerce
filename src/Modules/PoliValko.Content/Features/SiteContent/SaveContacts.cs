using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Content.Domain;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Settings;
using PoliValko.Infrastructure.Storefront;

namespace PoliValko.Content.Features.SiteContent;

internal static partial class SaveContacts
{
    public static async Task<Results<Ok<ContactsDto>, ValidationProblem>> HandleAsync(
        ContactsDto request,
        PoliValkoDbContext db,
        IAuditLog audit,
        IStorefrontCache storefront,
        ISettingsStore settings,
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
        CheckViber(errors, request.Viber);
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

        var before = SiteContentMapping.ToDto(contacts);
        contacts.StorePhone = SiteContentMapping.Clean(request.StorePhone);
        contacts.ServicesPhone = SiteContentMapping.Clean(request.ServicesPhone);
        contacts.Email = SiteContentMapping.Clean(request.Email);
        contacts.Address = SiteContentMapping.Clean(request.Address);
        contacts.Schedule = SiteContentMapping.Clean(request.Schedule);
        contacts.MapUrl = SiteContentMapping.Clean(request.MapUrl);
        contacts.Instagram = SiteContentMapping.Clean(request.Instagram);
        contacts.Facebook = SiteContentMapping.Clean(request.Facebook);
        contacts.Telegram = SiteContentMapping.Clean(request.Telegram);
        contacts.YouTube = SiteContentMapping.Clean(request.YouTube);
        contacts.Viber = SiteContentMapping.Clean(request.Viber);
        contacts.UpdatedAt = time.GetUtcNow();
        audit.Record("content.contacts_updated", "Contacts", null, new { before, after = SiteContentMapping.ToDto(contacts) });
        await db.SaveChangesAsync(ct);
        await storefront.InvalidateAsync([StorefrontTags.Content], ct);
        return TypedResults.Ok(SiteContentMapping.ToDto(contacts, await ShopSpecialDays.UpcomingAsync(settings, time, ct)));
    }

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

    private static void CheckViber(Dictionary<string, string[]> errors, string? value)
    {
        if (!string.IsNullOrWhiteSpace(value)
            && (value.Trim().Length > 300 || !Uri.TryCreate(value.Trim(), UriKind.Absolute, out var uri) || uri.Scheme is not ("https" or "http" or "viber")))
        {
            errors["viber"] = ["Вкажіть посилання, що починається з viber:// або https://."];
        }
    }

    [GeneratedRegex(@"^[^@\s]+@[^@\s]+\.[^@\s]+$")]
    private static partial Regex EmailPattern();
}

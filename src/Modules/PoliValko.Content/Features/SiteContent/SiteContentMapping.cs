using Microsoft.AspNetCore.Http.HttpResults;
using PoliValko.Content.Domain;
using PoliValko.Infrastructure.Web;

namespace PoliValko.Content.Features.SiteContent;

internal static class SiteContentMapping
{
    public static PageDto ToDto(ContentPage p) => new(p.Slug, p.Title, p.Lead, p.BodyHtml, p.UpdatedAt, p.UpdatedBy);

    public static ContactsDto ToDto(SiteContacts c) =>
        new(c.StorePhone, c.ServicesPhone, c.Email, c.Address, c.Schedule, c.MapUrl, c.Instagram, c.Facebook, c.Telegram, c.YouTube);

    public static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    public static ProblemHttpResult PageNotFound() => Problems.NotFound("content.page_not_found", "Сторінку не знайдено");
}

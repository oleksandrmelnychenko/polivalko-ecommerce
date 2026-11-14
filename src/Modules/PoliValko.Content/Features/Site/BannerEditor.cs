using Microsoft.AspNetCore.Http.HttpResults;
using PoliValko.Content.Domain;
using PoliValko.Infrastructure.Media;
using PoliValko.Infrastructure.Storefront;
using PoliValko.Infrastructure.Web;

namespace PoliValko.Content.Features.Site;

internal static class BannerEditor
{
    public static readonly IReadOnlyCollection<string> StorefrontTagsToInvalidate = [StorefrontTags.Content, StorefrontTags.Site, StorefrontTags.Home];

    public static Dictionary<string, string[]> Apply(Banner banner, SaveBannerRequest request)
    {
        var errors = new Dictionary<string, string[]>();
        var title = SiteLinks.Clean(request.Title);
        if (title is null || title.Length > Banner.TitleLength)
        {
            errors["title"] = [$"Вкажіть заголовок до {Banner.TitleLength} символів."];
        }

        var kicker = Limited(errors, "kicker", request.Kicker, Banner.KickerLength, "Напис над заголовком");
        var text = Limited(errors, "text", request.Text, Banner.TextLength, "Текст");
        var buttonLabel = Limited(errors, "buttonLabel", request.ButtonLabel, Banner.ButtonLabelLength, "Напис на кнопці");
        var link = SiteLinks.Clean(request.Link);
        if (link is not null && (link.Length > Banner.LinkLength || !SiteLinks.IsValid(link)))
        {
            errors["link"] = [$"Посилання має починатися з / або https:// і бути не довшим за {Banner.LinkLength} символів."];
        }

        var imageUrl = SiteLinks.Clean(request.ImageUrl);
        if (imageUrl is null)
        {
            errors["imageUrl"] = ["Завантажте фото банера."];
        }
        else if (!ImageUrls.IsValid(imageUrl))
        {
            errors["imageUrl"] = [ImageUrls.InvalidMessage];
        }

        var mobileImageUrl = SiteLinks.Clean(request.MobileImageUrl);
        if (mobileImageUrl is not null && !ImageUrls.IsValid(mobileImageUrl))
        {
            errors["mobileImageUrl"] = [ImageUrls.InvalidMessage];
        }

        if (request.StartsAt is { } startsAt && request.EndsAt is { } endsAt && endsAt < startsAt)
        {
            errors["endsAt"] = ["Дата завершення не може бути раніше за дату початку."];
        }

        if (errors.Count > 0)
        {
            return errors;
        }

        banner.Kicker = kicker;
        banner.Title = title!;
        banner.Text = text;
        banner.ButtonLabel = buttonLabel;
        banner.Link = link;
        banner.ImageUrl = imageUrl!;
        banner.MobileImageUrl = mobileImageUrl;
        banner.StartsAt = request.StartsAt?.ToUniversalTime();
        banner.EndsAt = request.EndsAt?.ToUniversalTime();
        banner.IsActive = request.IsActive;
        return errors;
    }

    public static BannerDto ToDto(Banner b) =>
        new(b.Id, b.Title, b.Text, b.ButtonLabel, b.Link, b.ImageUrl, b.MobileImageUrl, b.StartsAt, b.EndsAt, b.SortOrder, b.IsActive, b.UpdatedAt, b.Kicker);

    public static HomeBannerDto ToHomeDto(Banner b) =>
        new(b.Id, b.Title, b.Text, b.ButtonLabel, b.Link, b.ImageUrl, b.MobileImageUrl, b.StartsAt, b.EndsAt, b.Kicker);

    public static object Snapshot(Banner b) => new
    {
        b.Kicker,
        b.Title,
        b.Text,
        b.ButtonLabel,
        b.Link,
        b.ImageUrl,
        b.MobileImageUrl,
        b.StartsAt,
        b.EndsAt,
        b.IsActive,
    };

    public static ProblemHttpResult NotFound() => Problems.NotFound("content.banner_not_found", "Банер не знайдено");

    private static string? Limited(Dictionary<string, string[]> errors, string field, string? value, int max, string name)
    {
        var clean = SiteLinks.Clean(value);
        if (clean is not null && clean.Length > max)
        {
            errors[field] = [$"{name} має бути не довшим за {max} символів."];
        }

        return clean;
    }
}

using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Settings;
using PoliValko.Infrastructure.Storefront;

namespace PoliValko.Content.Features.Site;

internal static class SaveHomeSettings
{
    public const int AnnouncementLength = 160;
    public const int LinkLength = 300;
    public const int ItemTitleLength = 80;
    public const int ItemTextLength = 300;
    public const int VisitTextLength = 200;

    public static async Task<Results<Ok<HomeSettingsDto>, ValidationProblem>> HandleAsync(
        HomeSettingsDto request,
        ISettingsStore settings,
        IAuditLog audit,
        IStorefrontCache storefront,
        HttpContext http,
        CancellationToken ct)
    {
        var errors = Validate(request, out var value);
        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var before = await HomeSettingsStore.LoadAsync(settings, ct);
        audit.Record("site.home_updated", "SiteHome", null, new { before, after = value });
        await settings.SaveAsync(HomeSettingsStore.SettingsKey, value, http.User.StaffName(), ct);
        await storefront.InvalidateAsync([StorefrontTags.Content, StorefrontTags.Site, StorefrontTags.Home], ct);
        return TypedResults.Ok(value);
    }

    public static Dictionary<string, string[]> Validate(HomeSettingsDto request, out HomeSettingsDto value)
    {
        var errors = new Dictionary<string, string[]>();
        var blocks = (request.Blocks ?? []).Where(b => b is not null).ToList();
        var unknown = blocks.Select(b => b.Key).Where(k => !HomeSettingsStore.BlockKeys.Contains(k)).ToList();
        if (unknown.Count > 0)
        {
            errors["blocks"] = [$"Невідомі блоки: {string.Join(", ", unknown)}."];
        }
        else if (blocks.DistinctBy(b => b.Key).Count() != blocks.Count)
        {
            errors["blocks"] = ["Кожен блок має бути в списку один раз."];
        }

        var announcement = request.Announcement ?? HomeSettingsStore.Defaults.Announcement;
        var text = announcement.Text?.Trim() ?? string.Empty;
        if (text.Length > AnnouncementLength)
        {
            errors["announcement.text"] = [$"Оголошення — до {AnnouncementLength} символів."];
        }
        else if (announcement.IsActive && text.Length == 0)
        {
            errors["announcement.text"] = ["Вкажіть текст оголошення або вимкніть смугу."];
        }

        var link = SiteLinks.Clean(announcement.Link);
        if (link is not null && (link.Length > LinkLength || !SiteLinks.IsValid(link)))
        {
            errors["announcement.link"] = [SiteLinks.InvalidMessage];
        }

        if (announcement.StartsAt is { } startsAt && announcement.EndsAt is { } endsAt && endsAt < startsAt)
        {
            errors["announcement.endsAt"] = ["Дата завершення раніше за дату початку."];
        }

        var perks = Items(errors, "perks", request.Perks);
        var steps = Items(errors, "steps", request.Steps);
        var visitTitle = request.Visit?.Title?.Trim() ?? string.Empty;
        var visitText = request.Visit?.Text?.Trim() ?? string.Empty;
        if (visitTitle.Length is 0 or > ItemTitleLength)
        {
            errors["visit.title"] = [$"Вкажіть заголовок блоку до {ItemTitleLength} символів."];
        }

        if (visitText.Length > VisitTextLength)
        {
            errors["visit.text"] = [$"Текст — до {VisitTextLength} символів."];
        }

        value = HomeSettingsStore.Normalize(new HomeSettingsDto(
            blocks,
            new HomeAnnouncementDto(text, link, announcement.IsActive, announcement.StartsAt, announcement.EndsAt),
            perks,
            steps,
            new HomeItemDto(visitTitle, visitText)));
        return errors;
    }

    private static List<HomeItemDto> Items(Dictionary<string, string[]> errors, string field, IReadOnlyList<HomeItemDto>? items)
    {
        var list = (items ?? []).Where(i => i is not null).ToList();
        if (list.Count > HomeSettingsStore.MaxItems)
        {
            errors[field] = [$"Не більше {HomeSettingsStore.MaxItems} пунктів."];
        }

        var result = new List<HomeItemDto>(list.Count);
        for (var i = 0; i < list.Count; i++)
        {
            var title = list[i].Title?.Trim() ?? string.Empty;
            var text = list[i].Text?.Trim() ?? string.Empty;
            if (title.Length is 0 or > ItemTitleLength)
            {
                errors[$"{field}[{i}].title"] = [$"Вкажіть заголовок до {ItemTitleLength} символів."];
            }

            if (text.Length > ItemTextLength)
            {
                errors[$"{field}[{i}].text"] = [$"Текст — до {ItemTextLength} символів."];
            }

            result.Add(new HomeItemDto(title, text));
        }

        return result;
    }
}

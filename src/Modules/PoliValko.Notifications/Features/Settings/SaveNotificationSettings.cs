using System.Net.Mail;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Settings;
using PoliValko.Notifications.Integrations.Channels;

namespace PoliValko.Notifications.Features.Settings;

internal static partial class SaveNotificationSettings
{
    public const int MaxRecipients = 10;

    public static async Task<Results<Ok<NotificationSettingsDto>, ValidationProblem>> HandleAsync(
        SaveNotificationSettingsRequest request,
        ISettingsStore settings,
        [FromServices] IManagerChannel channel,
        IAuditLog audit,
        HttpContext http,
        CancellationToken ct)
    {
        var errors = new Dictionary<string, string[]>();
        var chats = Clean(request.TelegramChatIds, value => value);
        var emails = Clean(request.Emails, value => value.ToLowerInvariant());
        var badChats = chats.Where(c => !ChatId().IsMatch(c)).ToList();
        if (badChats.Count > 0)
        {
            errors["telegramChatIds"] = [$"Не схоже на ID чату: {string.Join(", ", badChats)}. Приклад: -1001234567890."];
        }
        else if (chats.Count > MaxRecipients)
        {
            errors["telegramChatIds"] = [$"Не більше {MaxRecipients} чатів."];
        }

        var badEmails = emails.Where(e => e.Length > 200 || !MailAddress.TryCreate(e, out _)).ToList();
        if (badEmails.Count > 0)
        {
            errors["emails"] = [$"Перевірте адреси: {string.Join(", ", badEmails)}."];
        }
        else if (emails.Count > MaxRecipients)
        {
            errors["emails"] = [$"Не більше {MaxRecipients} адрес."];
        }

        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var value = new NotificationSettingsStore.Stored(chats, emails, request.Events ?? NotificationSettingsStore.DefaultEvents);
        var before = await NotificationSettingsStore.LoadAsync(settings, ct);
        audit.Record("settings.notifications_updated", "NotificationSettings", null, new { before, after = value });
        await settings.SaveAsync(NotificationSettingsStore.SettingsKey, value, http.User.StaffName(), ct);
        return TypedResults.Ok(new NotificationSettingsDto(value.TelegramChatIds, value.Emails, value.Events, channel.IsConfigured));
    }

    private static List<string> Clean(IReadOnlyList<string>? values, Func<string, string> normalize) =>
        (values ?? [])
            .Where(v => !string.IsNullOrWhiteSpace(v))
            .Select(v => normalize(v.Trim()))
            .Distinct(StringComparer.Ordinal)
            .ToList();

    [GeneratedRegex(@"^(-?\d{5,20}|@[A-Za-z0-9_]{5,32})$")]
    private static partial Regex ChatId();
}

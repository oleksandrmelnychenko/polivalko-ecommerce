using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Settings;
using PoliValko.Infrastructure.Web;
using PoliValko.Notifications.Configuration;
using PoliValko.Notifications.Contracts;
using PoliValko.Notifications.Integrations.Channels;

namespace PoliValko.Notifications.Features.Settings;

internal static class SendTestNotification
{
    public static async Task<Results<Ok<NotificationTestResultDto>, ProblemHttpResult>> HandleAsync(
        ISettingsStore settings,
        [FromServices] IManagerChannel channel,
        IOptions<TelegramOptions> telegram,
        IAuditLog audit,
        PoliValkoDbContext db,
        HttpContext http,
        CancellationToken ct)
    {
        if (!channel.IsConfigured)
        {
            return Problems.Create(
                StatusCodes.Status409Conflict,
                "notifications.telegram_not_configured",
                "Бот Telegram не налаштований",
                "Токен бота задається в конфігурації сервера (Notifications:Telegram:BotToken).");
        }

        var chats = NotificationSettingsStore.ChatIds(await NotificationSettingsStore.LoadAsync(settings, ct), telegram.Value);
        if (chats.Count == 0)
        {
            return Problems.Create(
                StatusCodes.Status409Conflict,
                "notifications.no_recipients",
                "Немає жодного чату Telegram",
                "Додайте ID чату або групи й збережіть налаштування.");
        }

        var staff = http.User.StaffName();
        var delivered = await channel.SendAsync(
            new ManagerNotification("Тестове повідомлення", $"Сповіщення Poli Valko працюють. Перевірку запустив(ла): {staff}.", ManagerEvent.Test),
            chats,
            ct);
        audit.Record("settings.notifications_test_sent", "NotificationSettings", null, new { chats = chats.Count, delivered });
        await db.SaveChangesAsync(ct);
        if (delivered == 0)
        {
            return Problems.Create(
                StatusCodes.Status502BadGateway,
                "notifications.send_failed",
                "Telegram не прийняв повідомлення",
                "Перевірте ID чатів і чи доданий бот у групу.");
        }

        return TypedResults.Ok(new NotificationTestResultDto(chats.Count, delivered));
    }
}

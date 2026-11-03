using System.Net.Http.Json;
using Microsoft.Extensions.Options;
using PoliValko.Notifications.Configuration;
using PoliValko.Notifications.Contracts;

namespace PoliValko.Notifications.Integrations.Telegram;

internal sealed class TelegramManagerNotifier(HttpClient http, IOptions<TelegramOptions> options) : IManagerNotifier
{
    public async Task NotifyAsync(ManagerNotification notification, CancellationToken cancellationToken)
    {
        var settings = options.Value;
        using var response = await http.PostAsJsonAsync(
            $"https://api.telegram.org/bot{settings.BotToken}/sendMessage",
            new { chat_id = settings.ChatId, text = $"{notification.Title}\n\n{notification.Body}" },
            cancellationToken);

        response.EnsureSuccessStatusCode();
    }
}

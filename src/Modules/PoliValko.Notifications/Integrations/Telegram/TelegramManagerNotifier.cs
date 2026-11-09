using System.Net.Http.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using PoliValko.Notifications.Configuration;
using PoliValko.Notifications.Contracts;
using PoliValko.Notifications.Integrations.Channels;

namespace PoliValko.Notifications.Integrations.Telegram;

internal sealed class TelegramManagerNotifier(HttpClient http, IOptions<TelegramOptions> options, ILogger<TelegramManagerNotifier> logger)
    : IManagerChannel
{
    public bool IsConfigured => options.Value.IsConfigured;

    public async Task<int> SendAsync(ManagerNotification notification, IReadOnlyList<string> chatIds, CancellationToken cancellationToken)
    {
        if (chatIds.Count == 0)
        {
            logger.LogWarning("Повідомлення менеджеру не надіслано: не вказано жодного чату Telegram ({Title})", notification.Title);
            return 0;
        }

        var delivered = 0;
        foreach (var chatId in chatIds)
        {
            try
            {
                using var response = await http.PostAsJsonAsync(
                    $"https://api.telegram.org/bot{options.Value.BotToken}/sendMessage",
                    new { chat_id = chatId, text = $"{notification.Title}\n\n{notification.Body}" },
                    cancellationToken);
                if (response.IsSuccessStatusCode)
                {
                    delivered++;
                }
                else
                {
                    logger.LogWarning("Telegram не прийняв повідомлення для чату {ChatId}: {Status}", chatId, (int)response.StatusCode);
                }
            }
            catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException && !cancellationToken.IsCancellationRequested)
            {
                // Provider exceptions can include the credential-bearing request URI.
                logger.LogWarning("Telegram недоступний: повідомлення для чату {ChatId} не надіслано ({ErrorType})", chatId, ex.GetType().Name);
            }
        }

        return delivered;
    }
}

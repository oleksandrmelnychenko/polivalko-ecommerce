using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using PoliValko.Infrastructure.Settings;
using PoliValko.Notifications.Configuration;
using PoliValko.Notifications.Contracts;
using PoliValko.Notifications.Features.Settings;
using PoliValko.Notifications.Integrations.Channels;

namespace PoliValko.Notifications.Features.Dispatch;

internal sealed class ManagerNotifier(
    ISettingsStore settings,
    IManagerChannel channel,
    IOptions<TelegramOptions> telegram,
    ILogger<ManagerNotifier> logger) : IManagerNotifier
{
    public async Task NotifyAsync(ManagerNotification notification, CancellationToken cancellationToken)
    {
        var value = await NotificationSettingsStore.LoadAsync(settings, cancellationToken);
        if (!NotificationSettingsStore.IsEnabled(value.Events, notification.Event))
        {
            logger.LogInformation("Сповіщення «{Title}» вимкнено в налаштуваннях ({Event})", notification.Title, notification.Event);
            return;
        }

        var chats = NotificationSettingsStore.ChatIds(value, telegram.Value);
        var delivered = await channel.SendAsync(notification, chats, cancellationToken);
        if (channel.IsConfigured && chats.Count > 0 && delivered == 0)
        {
            throw new InvalidOperationException($"Telegram не прийняв повідомлення «{notification.Title}» у жоден із {chats.Count} чатів.");
        }
    }
}

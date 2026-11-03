using Microsoft.Extensions.Logging;
using PoliValko.Notifications.Contracts;

namespace PoliValko.Notifications.Integrations.Log;

internal sealed class LogManagerNotifier(ILogger<LogManagerNotifier> logger) : IManagerNotifier
{
    public Task NotifyAsync(ManagerNotification notification, CancellationToken cancellationToken)
    {
        logger.LogInformation("Повідомлення менеджеру (Telegram не налаштовано): {Title}", notification.Title);
        return Task.CompletedTask;
    }
}

using Microsoft.Extensions.Logging;
using PoliValko.Notifications.Contracts;
using PoliValko.Notifications.Integrations.Channels;

namespace PoliValko.Notifications.Integrations.Log;

internal sealed class LogManagerNotifier(ILogger<LogManagerNotifier> logger) : IManagerChannel
{
    public bool IsConfigured => false;

    public Task<int> SendAsync(ManagerNotification notification, IReadOnlyList<string> chatIds, CancellationToken cancellationToken)
    {
        logger.LogInformation("Повідомлення менеджеру (Telegram не налаштовано): {Title}", notification.Title);
        return Task.FromResult(0);
    }
}

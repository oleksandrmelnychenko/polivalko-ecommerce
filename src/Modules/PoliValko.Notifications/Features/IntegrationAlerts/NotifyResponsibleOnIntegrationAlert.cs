using PoliValko.Infrastructure.Outbox;
using PoliValko.Infrastructure.Sync;
using PoliValko.Notifications.Contracts;

namespace PoliValko.Notifications.Features.IntegrationAlerts;

internal sealed class NotifyResponsibleOnIntegrationAlert(IManagerNotifier notifier) : IOutboxHandler<IntegrationAlert>
{
    public Task HandleAsync(IntegrationAlert message, CancellationToken cancellationToken) =>
        notifier.NotifyAsync(new ManagerNotification($"⚠ {message.Title}", message.Body), cancellationToken);
}

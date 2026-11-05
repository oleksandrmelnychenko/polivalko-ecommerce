using PoliValko.Notifications.Contracts;

namespace PoliValko.Notifications.Integrations.Channels;

internal interface IManagerChannel
{
    bool IsConfigured { get; }

    Task<int> SendAsync(ManagerNotification notification, IReadOnlyList<string> chatIds, CancellationToken cancellationToken);
}

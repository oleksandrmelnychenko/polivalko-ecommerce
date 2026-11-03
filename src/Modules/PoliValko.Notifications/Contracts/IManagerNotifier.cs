namespace PoliValko.Notifications.Contracts;

public interface IManagerNotifier
{
    Task NotifyAsync(ManagerNotification notification, CancellationToken cancellationToken);
}

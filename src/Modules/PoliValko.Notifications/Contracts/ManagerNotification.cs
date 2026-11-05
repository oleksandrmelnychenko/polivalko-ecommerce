namespace PoliValko.Notifications.Contracts;

public sealed record ManagerNotification(string Title, string Body, ManagerEvent Event);

namespace PoliValko.Notifications.Features.Settings;

public sealed record NotificationEventsDto(bool NewOrder, bool NewServiceRequest, bool IntegrationAlert, bool PaymentAfterCancel);

public sealed record NotificationSettingsDto(
    IReadOnlyList<string> TelegramChatIds,
    IReadOnlyList<string> Emails,
    NotificationEventsDto Events,
    bool TelegramConfigured);

public sealed record SaveNotificationSettingsRequest(
    IReadOnlyList<string>? TelegramChatIds,
    IReadOnlyList<string>? Emails,
    NotificationEventsDto? Events);

public sealed record NotificationTestResultDto(int Chats, int Delivered);

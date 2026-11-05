using PoliValko.Infrastructure.Settings;
using PoliValko.Notifications.Configuration;
using PoliValko.Notifications.Contracts;

namespace PoliValko.Notifications.Features.Settings;

internal static class NotificationSettingsStore
{
    public const string SettingsKey = "settings.notifications";

    public static NotificationEventsDto DefaultEvents { get; } = new(true, true, true, true);

    public static async Task<Stored> LoadAsync(ISettingsStore settings, CancellationToken ct)
    {
        var stored = await settings.GetAsync<Stored>(SettingsKey, ct);
        return new Stored(stored?.TelegramChatIds ?? [], stored?.Emails ?? [], stored?.Events ?? DefaultEvents);
    }

    public static IReadOnlyList<string> ChatIds(Stored value, TelegramOptions options) =>
        value.TelegramChatIds is { Count: > 0 } stored
            ? stored
            : string.IsNullOrWhiteSpace(options.ChatId) ? [] : [options.ChatId.Trim()];

    public static bool IsEnabled(NotificationEventsDto events, ManagerEvent kind) => kind switch
    {
        ManagerEvent.NewOrder or ManagerEvent.OrderPaid => events.NewOrder,
        ManagerEvent.NewServiceRequest => events.NewServiceRequest,
        ManagerEvent.IntegrationAlert => events.IntegrationAlert,
        ManagerEvent.PaymentAfterCancel => events.PaymentAfterCancel,
        _ => true,
    };

    internal sealed record Stored(IReadOnlyList<string> TelegramChatIds, IReadOnlyList<string> Emails, NotificationEventsDto Events);
}

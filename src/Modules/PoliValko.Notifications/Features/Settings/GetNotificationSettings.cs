using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using PoliValko.Infrastructure.Settings;
using PoliValko.Notifications.Integrations.Channels;

namespace PoliValko.Notifications.Features.Settings;

internal static class GetNotificationSettings
{
    public static async Task<Ok<NotificationSettingsDto>> HandleAsync(
        ISettingsStore settings,
        [FromServices] IManagerChannel channel,
        CancellationToken ct)
    {
        var value = await NotificationSettingsStore.LoadAsync(settings, ct);
        return TypedResults.Ok(new NotificationSettingsDto(value.TelegramChatIds, value.Emails, value.Events, channel.IsConfigured));
    }
}

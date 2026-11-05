using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Security.Permissions;

namespace PoliValko.Notifications.Features.Settings;

internal static class NotificationSettingsEndpoints
{
    public static RouteGroupBuilder Map(RouteGroupBuilder console)
    {
        var notifications = console.MapGroup("/settings/notifications").WithTags("Console")
            .RequireStaff(PermissionKeys.SettingsNotificationsManage);

        notifications.MapGet(string.Empty, GetNotificationSettings.HandleAsync)
            .WithName("ConsoleGetNotificationSettings")
            .WithSummary("Кому й про що надсилати сповіщення: чати Telegram, e-mail, події; чи налаштований бот");
        notifications.MapPut(string.Empty, SaveNotificationSettings.HandleAsync)
            .WithName("ConsoleSaveNotificationSettings")
            .WithSummary("Зміна отримувачів і подій сповіщень");
        notifications.MapPost("/test", SendTestNotification.HandleAsync)
            .WithName("ConsoleSendTestNotification")
            .WithSummary("Тестове повідомлення в усі збережені чати Telegram")
            .ProducesProblem(StatusCodes.Status409Conflict)
            .ProducesProblem(StatusCodes.Status502BadGateway);

        return console;
    }
}

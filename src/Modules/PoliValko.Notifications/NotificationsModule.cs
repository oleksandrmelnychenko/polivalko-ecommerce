using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using PoliValko.Infrastructure;
using PoliValko.Infrastructure.Sync;
using PoliValko.Notifications.Configuration;
using PoliValko.Notifications.Contracts;
using PoliValko.Notifications.Features.Dispatch;
using PoliValko.Notifications.Features.IntegrationAlerts;
using PoliValko.Notifications.Features.Settings;
using PoliValko.Notifications.Integrations.Channels;
using PoliValko.Notifications.Integrations.Log;
using PoliValko.Notifications.Integrations.Smtp;
using PoliValko.Notifications.Integrations.Telegram;

namespace PoliValko.Notifications;

public static class NotificationsModule
{
    public static IServiceCollection AddNotificationsModule(this IServiceCollection services, IConfiguration configuration)
    {
        var section = configuration.GetSection("Notifications:Telegram");
        services.Configure<TelegramOptions>(section);

        if (section.Get<TelegramOptions>()?.IsConfigured == true)
        {
            services.AddHttpClient<IManagerChannel, TelegramManagerNotifier>(nameof(IManagerNotifier)).RemoveAllLoggers();
        }
        else
        {
            services.AddSingleton<IManagerChannel, LogManagerNotifier>();
        }

        services.AddScoped<IManagerNotifier, ManagerNotifier>();

        var email = configuration.GetSection("Email");
        var mode = email.Get<EmailOptions>()?.Mode;
        if (string.IsNullOrWhiteSpace(mode) || string.Equals(mode, EmailModes.Log, StringComparison.OrdinalIgnoreCase))
        {
            services.AddSingleton<ICustomerMailer, LogCustomerMailer>();
        }
        else if (string.Equals(mode, EmailModes.Smtp, StringComparison.OrdinalIgnoreCase))
        {
            services.AddOptions<SmtpOptions>()
                .Bind(email.GetSection("Smtp"))
                .Validate(options => options.IsConfigured, "Для SMTP задайте коректні Email:Smtp:Host, Port, From, Username і Password.")
                .ValidateOnStart();
            services.AddSingleton<ICustomerMailer, SmtpCustomerMailer>();
        }
        else
        {
            throw new InvalidOperationException($"Email:Mode не підтримується. Доступно: {EmailModes.Log}, {EmailModes.Smtp}.");
        }

        services.AddOutboxHandler<IntegrationAlert, NotifyResponsibleOnIntegrationAlert>();
        return services;
    }

    public static IEndpointRouteBuilder MapCustomerMailEndpoints(this IEndpointRouteBuilder api) =>
        Features.Mail.CustomerMailEndpoints.Map(api);

    public static RouteGroupBuilder MapConsoleNotificationSettingsEndpoints(this RouteGroupBuilder console) =>
        NotificationSettingsEndpoints.Map(console);
}

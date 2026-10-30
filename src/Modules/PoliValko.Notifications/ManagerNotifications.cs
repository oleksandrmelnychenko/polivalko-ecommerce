using System.Net.Http.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using PoliValko.Infrastructure;
using PoliValko.Infrastructure.Outbox;
using PoliValko.Infrastructure.Sync;

namespace PoliValko.Notifications;

public sealed record ManagerNotification(string Title, string Body);

/// <summary>Повідомлення відповідальному через погоджений канал (за пропозицією — Telegram).</summary>
public interface IManagerNotifier
{
    Task NotifyAsync(ManagerNotification notification, CancellationToken cancellationToken);
}

public sealed class TelegramOptions
{
    public string? BotToken { get; set; }

    public string? ChatId { get; set; }

    public bool IsConfigured => !string.IsNullOrWhiteSpace(BotToken) && !string.IsNullOrWhiteSpace(ChatId);
}

internal sealed class TelegramManagerNotifier(HttpClient http, IOptions<TelegramOptions> options) : IManagerNotifier
{
    public async Task NotifyAsync(ManagerNotification notification, CancellationToken cancellationToken)
    {
        var settings = options.Value;
        using var response = await http.PostAsJsonAsync(
            $"https://api.telegram.org/bot{settings.BotToken}/sendMessage",
            new { chat_id = settings.ChatId, text = $"{notification.Title}\n\n{notification.Body}" },
            cancellationToken);

        // Помилка доставки — виняток, тоді outbox повторить спробу.
        response.EnsureSuccessStatusCode();
    }
}

/// <summary>Для локальної розробки: пише в лог лише заголовок, без персональних даних.</summary>
internal sealed class LogManagerNotifier(ILogger<LogManagerNotifier> logger) : IManagerNotifier
{
    public Task NotifyAsync(ManagerNotification notification, CancellationToken cancellationToken)
    {
        logger.LogInformation("Повідомлення менеджеру (Telegram не налаштовано): {Title}", notification.Title);
        return Task.CompletedTask;
    }
}

public static class NotificationsModule
{
    public static IServiceCollection AddNotificationsModule(this IServiceCollection services, IConfiguration configuration)
    {
        var section = configuration.GetSection("Notifications:Telegram");
        services.Configure<TelegramOptions>(section);

        if (section.Get<TelegramOptions>()?.IsConfigured == true)
        {
            services.AddHttpClient<IManagerNotifier, TelegramManagerNotifier>();
        }
        else
        {
            services.AddSingleton<IManagerNotifier, LogManagerNotifier>();
        }

        services.AddOutboxHandler<IntegrationAlert, NotifyResponsibleOnIntegrationAlert>();
        return services;
    }
}

/// <summary>Критичний збій синхронізації чи фонової операції — тим самим каналом, що й нові замовлення.</summary>
internal sealed class NotifyResponsibleOnIntegrationAlert(IManagerNotifier notifier) : IOutboxHandler<IntegrationAlert>
{
    public Task HandleAsync(IntegrationAlert message, CancellationToken cancellationToken) =>
        notifier.NotifyAsync(new ManagerNotification($"⚠ {message.Title}", message.Body), cancellationToken);
}

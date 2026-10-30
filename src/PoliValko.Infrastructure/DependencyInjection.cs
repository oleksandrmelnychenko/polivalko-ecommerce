using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Idempotency;
using PoliValko.Infrastructure.Media;
using PoliValko.Infrastructure.Outbox;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Sync;
using PoliValko.Infrastructure.Web;

namespace PoliValko.Infrastructure;

public static class DependencyInjection
{
    public const string ConnectionStringName = "PoliValko";

    public static IServiceCollection AddPoliValkoPersistence(this IServiceCollection services)
    {
        // Рядок підключення читається під час створення контексту, а не під час реєстрації:
        // так хост стартує для генерації OpenAPI без БД, а тести можуть підмінити налаштування.
        services.AddDbContext<PoliValkoDbContext>((provider, options) =>
        {
            var connectionString = provider.GetRequiredService<IConfiguration>().GetConnectionString(ConnectionStringName)
                ?? throw new InvalidOperationException($"Не задано рядок підключення ConnectionStrings:{ConnectionStringName}.");

            options
                .UseNpgsql(connectionString, npgsql => npgsql.MigrationsHistoryTable("__ef_migrations_history", Schemas.Integration))
                .UseSnakeCaseNamingConvention();
        });

        services.AddSingleton(TimeProvider.System);
        services.AddScoped<IOutbox, EfOutbox>();
        services.AddScoped<OutboxProcessor>();
        services.AddOptions<OutboxOptions>().BindConfiguration("Outbox");
        services.AddOptions<SyncOptions>().BindConfiguration("Sync");
        services.AddOptions<MediaOptions>().BindConfiguration("Media");
        services.AddOptions<SiteOptions>().BindConfiguration("Site");
        services.AddHttpContextAccessor();
        services.AddScoped<ISyncJournal, SyncJournal>();
        services.AddScoped<IAuditLog, EfAuditLog>();
        services.AddSingleton<IMediaStorage, LocalMediaStorage>();
        services.AddSingleton<IRichTextSanitizer, RichTextSanitizer>();
        services.AddOptions<StorefrontOptions>().BindConfiguration("Web");
        services.AddHttpClient<IStorefrontCache, StorefrontCache>(client => client.Timeout = TimeSpan.FromSeconds(5));
        return services;
    }

    public static IServiceCollection AddModelConfigurator<TConfigurator>(this IServiceCollection services)
        where TConfigurator : class, IModelConfigurator =>
        services.AddSingleton<IModelConfigurator, TConfigurator>();

    public static IServiceCollection AddOutboxHandler<TMessage, THandler>(this IServiceCollection services)
        where TMessage : IOutboxMessage
        where THandler : class, IOutboxHandler<TMessage>
    {
        services.AddScoped<IOutboxHandler<TMessage>, THandler>();
        services.Configure<OutboxHandlerRegistry>(registry => registry.Register<TMessage>());
        return services;
    }

    /// <summary>Фонові процеси платформи. Реєструються лише в хості Worker.</summary>
    public static IServiceCollection AddPlatformBackgroundServices(this IServiceCollection services)
    {
        services.AddHostedService<OutboxDispatcherService>();
        services.AddHostedService<IdempotencyCleanupService>();
        return services;
    }
}

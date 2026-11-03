using System.Collections.Concurrent;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using PoliValko.Catalog.Domain;
using PoliValko.Identity;
using PoliValko.Infrastructure;
using PoliValko.Infrastructure.Outbox;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Security;
using PoliValko.IntegrationTests;
using PoliValko.Notifications.Contracts;
using Testcontainers.PostgreSql;

[assembly: AssemblyFixture(typeof(ApiFactory))]

[assembly: Xunit.v3.Parallelization(Mode = Xunit.Sdk.ParallelMode.None)]

namespace PoliValko.IntegrationTests;

public sealed class ApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder("postgres:18").Build();

    public const string AdminEmail = "admin@tests.polivalko.local";
    public const string ManagerEmail = "manager@tests.polivalko.local";

    public const string TestPassword = "Test-only-password-2026";

    public const string SandboxSecret = "test-sandbox-secret";

    public RecordingNotifier Notifier { get; } = new();

    public async ValueTask InitializeAsync()
    {
        await _postgres.StartAsync();
        await using var scope = Services.CreateAsyncScope();
        await scope.ServiceProvider.GetRequiredService<PoliValkoDbContext>().Database.MigrateAsync();
        await IdentityModule.SeedUsersAsync(Services);
    }

    public override async ValueTask DisposeAsync()
    {
        await base.DisposeAsync();
        await _postgres.DisposeAsync();
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("ConnectionStrings:PoliValko", _postgres.GetConnectionString());
        builder.UseSetting("RateLimiting:Forms:PermitLimit", "1000");
        builder.UseSetting("RateLimiting:Orders:PermitLimit", "1000");
        builder.UseSetting("RateLimiting:Login:PermitLimit", "1000");
        builder.UseSetting("Payments:Provider", "Sandbox");
        builder.UseSetting("Payments:Sandbox:Secret", SandboxSecret);
        builder.UseSetting("Fiscal:Provider", "Stub");
        builder.UseSetting("Media:Root", Path.Combine(Path.GetTempPath(), "polivalko-tests-media"));
        SeedUser(builder, 0, AdminEmail, StaffRoles.Admin);
        SeedUser(builder, 1, ManagerEmail, StaffRoles.Manager);
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<IManagerNotifier>();
            services.AddSingleton<IManagerNotifier>(Notifier);
            services.AddOutboxHandler<AlwaysFailingMessage, AlwaysFailingHandler>();
        });
    }

    private static void SeedUser(IWebHostBuilder builder, int index, string email, string role)
    {
        builder.UseSetting($"Seed:Users:{index}:Email", email);
        builder.UseSetting($"Seed:Users:{index}:Password", TestPassword);
        builder.UseSetting($"Seed:Users:{index}:DisplayName", role == StaffRoles.Admin ? "Адмін Тестовий" : "Менеджер Тестовий");
        builder.UseSetting($"Seed:Users:{index}:Role", role);
    }

    public async Task<T> WithScopeAsync<T>(Func<IServiceProvider, Task<T>> action)
    {
        await using var scope = Services.CreateAsyncScope();
        return await action(scope.ServiceProvider);
    }

    public Task<T> WithDbAsync<T>(Func<PoliValkoDbContext, Task<T>> action) =>
        WithScopeAsync(services => action(services.GetRequiredService<PoliValkoDbContext>()));

    public Task<int> ProcessOutboxAsync() =>
        WithScopeAsync(services => services.GetRequiredService<OutboxProcessor>()
            .ProcessBatchAsync(TestContext.Current.CancellationToken));

    public Task<Product> AddProductAsync(
        string categorySlug,
        string name,
        decimal price,
        decimal stock = 5,
        decimal? oldPrice = null,
        bool visible = true,
        string? brand = null,
        string? slug = null) =>
        WithDbAsync(async db =>
        {
            var ct = TestContext.Current.CancellationToken;
            var categoryId = await db.Set<Category>().Where(c => c.Slug == categorySlug).Select(c => c.Id).SingleAsync(ct);
            var id = Guid.CreateVersion7();
            var now = DateTimeOffset.UtcNow;
            var product = new Product
            {
                Id = id,
                NavkoloId = $"nk-{id:N}",
                Sku = $"T-{id.ToString("N")[^8..].ToUpperInvariant()}",
                Name = name,
                Slug = slug ?? $"test-{id:N}",
                CategoryId = categoryId,
                Brand = brand,
                IsVisible = visible,
                CreatedAt = now,
                Price = new ProductPrice { ProductId = id, Amount = price, OldAmount = oldPrice, UpdatedAt = now },
                Stock = new ProductStock { ProductId = id, Quantity = stock, UpdatedAt = now },
            };
            db.Add(product);
            await db.SaveChangesAsync(ct);
            return product;
        });
}

public sealed class RecordingNotifier : IManagerNotifier
{
    public ConcurrentQueue<ManagerNotification> Sent { get; } = new();

    public Task NotifyAsync(ManagerNotification notification, CancellationToken cancellationToken)
    {
        Sent.Enqueue(notification);
        return Task.CompletedTask;
    }
}

public sealed record AlwaysFailingMessage(string Marker) : IOutboxMessage
{
    public static string Type => "tests.always-failing";
}

internal sealed class AlwaysFailingHandler : IOutboxHandler<AlwaysFailingMessage>
{
    public Task HandleAsync(AlwaysFailingMessage message, CancellationToken cancellationToken) =>
        throw new InvalidOperationException($"Navkolo недоступна ({message.Marker})");
}

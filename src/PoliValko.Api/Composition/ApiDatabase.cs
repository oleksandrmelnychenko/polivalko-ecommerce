using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog;
using PoliValko.Content;
using PoliValko.Identity;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Api.Composition;

public static class ApiDatabase
{
    public static async Task PrepareDatabaseAsync(this WebApplication app)
    {
        var migrate = app.Configuration.GetValue<bool>("Database:ApplyMigrationsOnStartup");
        var seed = app.Configuration.GetValue<bool>("Database:SeedDemoData");
        var seedUsers = app.Configuration.GetSection("Seed:Users").Exists();
        if (!migrate && !seed && !seedUsers)
        {
            return;
        }

        await using var scope = app.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<PoliValkoDbContext>();
        if (migrate)
        {
            await db.Database.MigrateAsync();
        }

        if ((await db.Database.GetPendingMigrationsAsync()).Any())
        {
            app.Logger.LogWarning("БД ще не мігрована: демо-дані й працівники з Seed:Users не створені");
            return;
        }

        if (seed)
        {
            await CatalogModule.SeedDemoDataAsync(scope.ServiceProvider);
        }

        await CatalogModule.SyncDictionariesAsync(scope.ServiceProvider);

        await ContentModule.SeedSiteAsync(scope.ServiceProvider);

        await IdentityModule.SeedUsersAsync(app.Services);
    }
}

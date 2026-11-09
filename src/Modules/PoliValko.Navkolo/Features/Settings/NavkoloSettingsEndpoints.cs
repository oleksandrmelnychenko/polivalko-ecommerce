using System.Text.Json;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Security.Permissions;
using PoliValko.Infrastructure.Settings;
using PoliValko.Infrastructure.Sync;
using PoliValko.Infrastructure.Web;
using PoliValko.Navkolo.Configuration;
using PoliValko.Navkolo.Contracts;
using PoliValko.Navkolo.Integrations.NavkoloApi;

namespace PoliValko.Navkolo.Features.Settings;

internal static class NavkoloSettingsEndpoints
{
    public static RouteGroupBuilder Map(RouteGroupBuilder console)
    {
        var group = console.MapGroup("/settings/navkolo").WithTags("Console").RequireStaff(PermissionKeys.SettingsNavkoloManage);
        group.AddEndpointFilter(async (context, next) =>
        {
            context.HttpContext.Response.Headers.CacheControl = "no-store";
            return await next(context);
        });
        group.MapGet("", GetAsync).WithName("ConsoleGetNavkoloSettings").Produces<NavkoloConnectionDto>();
        group.MapPost("/check", CheckAsync).WithName("ConsoleCheckNavkoloConnection").Produces<CheckNavkoloDto>().RequireRateLimiting(RateLimitPolicies.Forms);
        group.MapPut("", SaveAsync).WithName("ConsoleSaveNavkoloSettings").Produces<NavkoloConnectionDto>().RequireRateLimiting(RateLimitPolicies.Forms);
        return console;
    }

    private static async Task<NavkoloConnectionDto> DtoAsync(NavkoloSettings settings, CancellationToken ct)
    {
        var stored = await settings.ReadAsync(ct);
        // Do not decrypt the saved secret just to display connection metadata.
        if (stored is not null) return new(stored.Revision, stored.Mode, stored.ProtectedKey is not null, stored.StoreId, stored.StoreName, stored.VerifiedAt, "console", stored.CancellationStatusId, stored.CancellationStatusName);
        var options = await settings.LoadAsync(ct);
        return new(null, options.Mode, !string.IsNullOrEmpty(options.ApiKey), options.StoreId, null, null, "environment", options.CancellationStatusId);
    }

    private static async Task<IResult> GetAsync(NavkoloSettings settings, CancellationToken ct) => Results.Ok(await DtoAsync(settings, ct));

    private static bool ValidKey(string? key) => key is null || (key.Length <= 2048 && key.All(c => c >= '!' && c <= '~'));
    private static IResult Invalid(string field, string message) => Results.ValidationProblem(new Dictionary<string, string[]> { [field] = [message] });
    private static IResult ConnectionError() => Problems.Create(502, "navkolo.connection_failed", "Не вдалося підключитися до Навколо", "Перевірте ключ, дозвіл API та доступність Навколо. Збережені налаштування не змінено.");

    private static async Task<IResult> CheckAsync(CheckNavkoloRequest request, NavkoloSettings settings, NavkoloClientFactory factory, CancellationToken ct)
    {
        if (!ValidKey(request.ApiKey)) return Invalid("apiKey", "Некоректний формат ключа API.");
        try
        {
            var options = string.IsNullOrEmpty(request.ApiKey) ? await settings.LoadAsync(ct) : new NavkoloOptions { ApiKey = request.ApiKey };
            if (string.IsNullOrEmpty(options.ApiKey)) return Invalid("apiKey", "Вставте ключ API.");
            var client = factory.Create(options);
            var stores = await client.GetStoresAsync(ct);
            var statuses = await client.GetStatusesAsync(ct);
            return Results.Ok(new CheckNavkoloDto(stores, statuses));
        }
        catch (Exception ex) when (IsConnectionFailure(ex, ct)) { return ConnectionError(); }
    }

    private static async Task<IResult> SaveAsync(SaveNavkoloConnectionRequest request, NavkoloSettings settings,
        NavkoloClientFactory factory, PoliValkoDbContext db, IAuditLog audit, HttpContext http, TimeProvider time, CancellationToken ct)
    {
        if (!ValidKey(request.ApiKey)) return Invalid("apiKey", "Некоректний формат ключа API.");
        if (request.ClearKey && (!string.IsNullOrEmpty(request.ApiKey) || request.Enabled)) return Invalid("apiKey", "Щоб видалити ключ, вимкніть синхронізацію й залиште поле порожнім.");
        if (!string.IsNullOrEmpty(request.StoreId) && !Guid.TryParse(request.StoreId, out _)) return Invalid("storeId", "Оберіть склад зі списку Навколо.");
        try
        {
            var current = await settings.ReadAsync(ct);
            if (current?.Revision != request.Revision) return Conflict();
            var key = request.ClearKey ? "" : string.IsNullOrEmpty(request.ApiKey) ? (await settings.LoadAsync(ct)).ApiKey : request.ApiKey;
            var storeId = string.IsNullOrEmpty(request.StoreId) ? null : Guid.Parse(request.StoreId).ToString();
            var storeName = current?.StoreId == storeId ? current?.StoreName : null;
            var cancellationStatusId = request.CancellationStatusId;
            var cancellationStatusName = current?.CancellationStatusId == cancellationStatusId ? current?.CancellationStatusName : null;
            DateTimeOffset? verified = null;
            if (request.Enabled)
            {
                if (string.IsNullOrEmpty(key)) return Invalid("apiKey", "Вставте ключ API.");
                var client = factory.Create(new NavkoloOptions { ApiKey = key });
                var stores = await client.GetStoresAsync(ct);
                if (storeId is null && stores.Count == 1) storeId = stores[0].Id;
                var store = stores.SingleOrDefault(s => s.Id == storeId);
                if (store is null) return Invalid("storeId", "Оберіть доступний склад Навколо.");
                var statuses = await client.GetStatusesAsync(ct);
                var cancellationStatus = statuses.SingleOrDefault(s => s.Id == cancellationStatusId);
                if (cancellationStatus is null) return Invalid("cancellationStatusId", "Оберіть статус скасування Навколо.");
                cancellationStatusName = cancellationStatus.Name;
                storeName = store.Name;
                verified = time.GetUtcNow();
            }

            await using var tx = await db.Database.BeginTransactionAsync(ct);
            // Serialize credential/store changes with catalog imports, including across processes.
            await db.Database.ExecuteSqlAsync($"SELECT pg_advisory_xact_lock(hashtextextended({"navkolo.inventory-sync"}, 0))", ct);
            if ((await settings.ReadAsync(ct))?.Revision != request.Revision) return Conflict();
            var mode = request.Enabled ? NavkoloModes.DnTrade : NavkoloModes.Disabled;
            var value = new NavkoloSettings.Stored(Guid.NewGuid(), mode, key.Length == 0 ? null : settings.Protect(key), storeId, storeName, verified, cancellationStatusId, cancellationStatusName);
            var row = await db.Set<PlatformSetting>().SingleOrDefaultAsync(s => s.Key == NavkoloSettings.Key, ct);
            if (row is null) { row = new PlatformSetting { Key = NavkoloSettings.Key, Value = "", UpdatedBy = http.User.StaffName() }; db.Add(row); }
            row.Value = JsonSerializer.Serialize(value);
            row.UpdatedAt = time.GetUtcNow(); row.UpdatedBy = http.User.StaffName();
            audit.Record("settings.navkolo_updated", "NavkoloSettings", null, new { mode, storeId, cancellationStatusId, keyChanged = !string.IsNullOrEmpty(request.ApiKey) || request.ClearKey });
            // Previous-account success cannot make the new connection look fresh. Request a new snapshot.
            foreach (var job in new[] { NavkoloJobs.PriceStock, NavkoloJobs.Catalog })
            {
                var state = await db.Set<SyncState>().SingleOrDefaultAsync(s => s.Job == job, ct);
                if (state is null) { state = new SyncState { Job = job }; db.Add(state); }
                state.LastSuccessAt = null;
                state.RunRequestedAt = request.Enabled ? time.GetUtcNow() : null;
            }
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            return Results.Ok(await DtoAsync(settings, ct));
        }
        catch (Exception ex) when (IsConnectionFailure(ex, ct)) { return ConnectionError(); }
    }

    private static IResult Conflict() => Problems.Create(409, "navkolo.settings_changed", "Налаштування вже змінено", "Оновіть сторінку й повторіть зміну.");
    private static bool IsConnectionFailure(Exception ex, CancellationToken ct) => ex is NavkoloUnavailableException or HttpRequestException or JsonException or CryptographicException
        || ex is OperationCanceledException && !ct.IsCancellationRequested;
}

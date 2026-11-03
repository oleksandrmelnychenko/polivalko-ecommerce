using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using PoliValko.Delivery.Configuration;
using PoliValko.Delivery.Contracts;
using PoliValko.Delivery.Domain;
using PoliValko.Delivery.Jobs;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Sync;

namespace PoliValko.Delivery.Features.Admin;

internal static class GetNovaPoshtaStatus
{
    public const string DemoMode = "demo";
    public const string ApiMode = "api";

    public static async Task<Ok<NovaPoshtaStatusDto>> HandleAsync(
        PoliValkoDbContext db,
        IOptions<NovaPoshtaOptions> options,
        CancellationToken ct)
    {
        var settlements = await db.Set<NpSettlement>().CountAsync(s => s.IsActive, ct);
        var warehouses = await db.Set<NpWarehouse>().CountAsync(w => w.IsActive, ct);
        var postomats = await db.Set<NpWarehouse>().CountAsync(w => w.IsActive && w.Type == WarehouseType.Postomat, ct);
        var state = await db.Set<SyncState>().AsNoTracking().FirstOrDefaultAsync(s => s.Job == NovaPoshtaSyncJob.JobName, ct);

        return TypedResults.Ok(new NovaPoshtaStatusDto(
            options.Value.IsConfigured ? ApiMode : DemoMode,
            settlements,
            warehouses,
            postomats,
            new NovaPoshtaSyncStateDto(state?.LastAttemptAt, state?.LastSuccessAt, state?.LastError, state?.ConsecutiveFailures ?? 0)));
    }
}

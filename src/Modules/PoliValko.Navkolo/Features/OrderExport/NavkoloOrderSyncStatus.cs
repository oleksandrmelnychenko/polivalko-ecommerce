using PoliValko.Navkolo.Configuration;
using PoliValko.Navkolo.Contracts;
using PoliValko.Ordering.Contracts;

namespace PoliValko.Navkolo.Features.OrderExport;

internal sealed class NavkoloOrderSyncStatus(INavkoloSettings settings) : IExternalOrderSyncStatus
{
    public async Task<bool> IsEnabledAsync(CancellationToken ct) =>
        settings.OrderSyncEnabled && await settings.GetModeAsync(ct) != NavkoloModes.Disabled;
}

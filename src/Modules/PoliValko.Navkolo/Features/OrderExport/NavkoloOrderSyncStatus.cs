using PoliValko.Navkolo.Contracts;
using PoliValko.Ordering.Contracts;

namespace PoliValko.Navkolo.Features.OrderExport;

internal sealed class NavkoloOrderSyncStatus(INavkoloSettings settings) : IExternalOrderSyncStatus
{
    public bool IsEnabled => settings.OrderSyncEnabled;
}

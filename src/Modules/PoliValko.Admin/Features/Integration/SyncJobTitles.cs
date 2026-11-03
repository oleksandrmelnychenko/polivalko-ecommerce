using PoliValko.Delivery.Contracts;
using PoliValko.Navkolo.Contracts;
using PoliValko.Payments.Contracts;

namespace PoliValko.Admin.Features.Integration;

internal static class SyncJobTitles
{
    public static readonly Dictionary<string, string> All = new(StringComparer.Ordinal)
    {
        [NavkoloJobs.PriceStock] = "Navkolo: ціни й залишки",
        [NavkoloJobs.Catalog] = "Navkolo: каталог",
        [NavkoloJobs.Import] = "Імпорт каталогу з файлу",
        [DeliveryJobs.NovaPoshtaDirectory] = "Нова пошта: довідник",
        [PaymentJobs.Reconcile] = "Звірка оплат",
    };
}

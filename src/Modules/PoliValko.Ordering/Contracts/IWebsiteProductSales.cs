using PoliValko.SharedKernel;

namespace PoliValko.Ordering.Contracts;

public interface IWebsiteProductSales
{
    Task<ProductSalesData> ReadAsync(DateOnly from, DateOnly to, CancellationToken ct);
}

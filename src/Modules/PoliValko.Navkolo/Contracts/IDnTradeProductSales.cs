using PoliValko.SharedKernel;

namespace PoliValko.Navkolo.Contracts;

public interface IDnTradeProductSales
{
    Task<ProductSalesData> ReadAsync(DateOnly from, DateOnly to, CancellationToken ct);
}

using PoliValko.Ordering.Contracts;
using PoliValko.SharedKernel;

namespace PoliValko.Console.Features.Dashboard;

public sealed record DashboardTotalsDto(MoneyDto Revenue, int Orders, MoneyDto AverageOrder, int Customers, int Cancelled);

public sealed record DashboardDayDto(DateOnly Date, int Orders, MoneyDto Revenue);

public sealed record DashboardTopProductDto(Guid ProductId, string Name, string Sku, string? ImageUrl, int Quantity, MoneyDto Revenue);

public sealed record DashboardLowStockDto(Guid Id, string Name, string Sku, decimal Stock);

public sealed record DashboardDeliveryDto(string Method, int Count);

public sealed record ConsoleDashboardDto(
    int Days,
    DashboardTotalsDto Current,
    DashboardTotalsDto Previous,
    IReadOnlyList<DashboardDayDto> ByDay,
    IReadOnlyList<OrderStatusCountDto> ByStatus,
    IReadOnlyList<DashboardTopProductDto> TopProducts,
    IReadOnlyList<DashboardLowStockDto> LowStock,
    IReadOnlyList<DashboardDeliveryDto> ByDelivery);

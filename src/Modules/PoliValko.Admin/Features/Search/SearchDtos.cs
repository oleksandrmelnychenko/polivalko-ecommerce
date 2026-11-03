using PoliValko.Ordering.Contracts;
using PoliValko.SharedKernel;

namespace PoliValko.Admin.Features.Search;

public sealed record SearchOrderHitDto(string Number, string CustomerName, string Phone, OrderStatus Status, MoneyDto Total, DateTimeOffset CreatedAt);

public sealed record SearchProductHitDto(Guid Id, string Name, string Sku, string? ImageUrl, MoneyDto Price, bool IsVisible);

public sealed record SearchCustomerHitDto(string Phone, string Name, int Orders);

public sealed record AdminSearchDto(
    IReadOnlyList<SearchOrderHitDto> Orders,
    IReadOnlyList<SearchProductHitDto> Products,
    IReadOnlyList<SearchCustomerHitDto> Customers);

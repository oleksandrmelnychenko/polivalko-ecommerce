namespace PoliValko.Ordering.Contracts;

public interface IOrderReporting
{
    Task<IReadOnlyList<OrderPeriodRow>> ListForPeriodAsync(DateTimeOffset from, DateTimeOffset to, CancellationToken ct);

    Task<IReadOnlyList<ProductSalesRow>> TopProductsAsync(DateTimeOffset from, DateTimeOffset to, int take, CancellationToken ct);

    Task<IReadOnlyList<OrderedProductSnapshot>> OrderedProductSnapshotsAsync(IReadOnlyCollection<Guid> productIds, CancellationToken ct);

    Task<IReadOnlyList<OrderSearchHit>> SearchOrdersAsync(string term, int limit, CancellationToken ct);

    Task<IReadOnlyList<CustomerSearchHit>> SearchCustomersAsync(string term, int limit, CancellationToken ct);

    Task<IReadOnlyDictionary<OrderStatus, int>> CountOpenByStatusAsync(CancellationToken ct);

    Task<int> CountPendingRefundsAsync(CancellationToken ct);
}

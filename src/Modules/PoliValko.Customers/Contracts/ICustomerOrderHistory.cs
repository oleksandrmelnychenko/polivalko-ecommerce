namespace PoliValko.Customers.Contracts;

public interface ICustomerOrderHistory
{
    Task<IReadOnlyDictionary<Guid, int>> CountOrdersAsync(IReadOnlyCollection<Guid> customerIds, CancellationToken ct);

    Task<IReadOnlyList<CustomerOrderRecord>> ListOrdersAsync(Guid customerId, int take, CancellationToken ct);
}

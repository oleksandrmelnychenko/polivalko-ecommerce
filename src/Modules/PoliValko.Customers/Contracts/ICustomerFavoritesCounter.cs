namespace PoliValko.Customers.Contracts;

public interface ICustomerFavoritesCounter
{
    Task<int> CountFavoritesAsync(Guid customerId, CancellationToken ct);
}

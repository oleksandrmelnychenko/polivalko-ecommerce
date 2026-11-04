namespace PoliValko.Customers.Contracts;

public interface ICustomerDirectory
{
    Task<Guid?> FindConfirmedIdByEmailAsync(string email, CancellationToken ct);
}

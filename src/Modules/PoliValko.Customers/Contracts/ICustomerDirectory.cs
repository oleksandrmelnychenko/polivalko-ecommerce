namespace PoliValko.Customers.Contracts;

public sealed record CustomerBrief(Guid Id, string Name, string? Phone, string Email);

public interface ICustomerDirectory
{
    Task<Guid?> FindConfirmedIdByEmailAsync(string email, CancellationToken ct);
    Task<IReadOnlyDictionary<Guid, CustomerBrief>> GetBriefsAsync(IReadOnlyCollection<Guid> ids, CancellationToken ct);
}

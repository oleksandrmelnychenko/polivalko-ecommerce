namespace PoliValko.Customers.Contracts;

public interface ICustomerEmailConfirmedHandler
{
    Task OnEmailConfirmedAsync(Guid customerId, string email, CancellationToken ct);
}

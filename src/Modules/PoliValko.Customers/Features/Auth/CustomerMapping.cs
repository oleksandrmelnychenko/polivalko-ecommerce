using PoliValko.Customers.Domain;

namespace PoliValko.Customers.Features.Auth;

internal static class CustomerMapping
{
    public static CustomerMeDto ToMe(Customer customer) =>
        new(customer.Id, customer.Email, customer.EmailConfirmedAt is not null, customer.Name, customer.Phone);
}

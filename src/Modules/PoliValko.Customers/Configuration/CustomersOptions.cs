namespace PoliValko.Customers.Configuration;

public sealed class CustomersOptions
{
    public TimeSpan SessionCheckInterval { get; set; } = TimeSpan.FromMinutes(1);
}

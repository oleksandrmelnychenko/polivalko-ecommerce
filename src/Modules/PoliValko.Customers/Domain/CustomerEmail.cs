namespace PoliValko.Customers.Domain;

public static class CustomerEmail
{
    public static string Normalize(string email) => email.Trim().ToUpperInvariant();
}

using Microsoft.AspNetCore.Identity;
using PoliValko.Customers.Domain;

namespace PoliValko.Customers.Features.Auth;

internal sealed class CustomerPasswords
{
    private static readonly Customer Placeholder = new() { Email = string.Empty, NormalizedEmail = string.Empty, Name = string.Empty };

    private readonly IPasswordHasher<Customer> _hasher;
    private readonly Lazy<string> _placeholderHash;

    public CustomerPasswords(IPasswordHasher<Customer> hasher)
    {
        _hasher = hasher;
        _placeholderHash = new(() => hasher.HashPassword(Placeholder, Guid.NewGuid().ToString("N")));
    }

    public string Hash(Customer customer, string password) => _hasher.HashPassword(customer, password);

    public PasswordVerificationResult Verify(Customer customer, string password) =>
        _hasher.VerifyHashedPassword(customer, customer.PasswordHash, password);

    public void VerifyPlaceholder(string? password) =>
        _hasher.VerifyHashedPassword(Placeholder, _placeholderHash.Value, password ?? string.Empty);
}

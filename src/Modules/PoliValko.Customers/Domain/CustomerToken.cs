using System.Buffers.Text;
using System.Security.Cryptography;
using System.Text;

namespace PoliValko.Customers.Domain;

public sealed class CustomerToken
{
    public Guid Id { get; init; }

    public Guid CustomerId { get; init; }

    public CustomerTokenPurpose Purpose { get; init; }

    public required string TokenHash { get; init; }

    public DateTimeOffset CreatedAt { get; init; }

    public DateTimeOffset ExpiresAt { get; init; }

    public DateTimeOffset? UsedAt { get; set; }

    public bool IsUsable(DateTimeOffset now) => UsedAt is null && ExpiresAt > now;

    public static TimeSpan LifetimeOf(CustomerTokenPurpose purpose) => purpose switch
    {
        CustomerTokenPurpose.EmailConfirmation => TimeSpan.FromDays(3),
        _ => TimeSpan.FromHours(1),
    };

    public static (CustomerToken Token, string Value) Issue(Guid customerId, CustomerTokenPurpose purpose, DateTimeOffset now)
    {
        var value = Base64Url.EncodeToString(RandomNumberGenerator.GetBytes(32));
        var token = new CustomerToken
        {
            Id = Guid.CreateVersion7(now),
            CustomerId = customerId,
            Purpose = purpose,
            TokenHash = Hash(value),
            CreatedAt = now,
            ExpiresAt = now + LifetimeOf(purpose),
        };
        return (token, value);
    }

    public static string Hash(string value) => Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(value)));
}

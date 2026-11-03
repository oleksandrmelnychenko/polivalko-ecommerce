using System.Security.Cryptography;
using System.Text;

namespace PoliValko.Ordering.Domain;

internal static class OrderTokens
{
    public static (string Token, string Hash) Create()
    {
        var token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
        return (token, Hash(token));
    }

    public static bool Matches(string? token, string hash) =>
        !string.IsNullOrEmpty(token)
        && CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(Hash(token)), Encoding.ASCII.GetBytes(hash));

    private static string Hash(string token) => Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
}

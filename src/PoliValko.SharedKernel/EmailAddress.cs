using System.Net.Mail;

namespace PoliValko.SharedKernel;

public static class EmailAddress
{
    public const int MaxLength = 200;

    public static bool IsValid(string? value) =>
        !string.IsNullOrEmpty(value)
        && value.Length <= MaxLength
        && MailAddress.TryCreate(value, out var parsed)
        && parsed.Address == value
        && parsed.Host.Contains('.')
        && !parsed.Host.StartsWith('.')
        && !parsed.Host.EndsWith('.')
        && !parsed.Host.StartsWith('[');
}

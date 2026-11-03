using System.Text;

namespace PoliValko.Delivery.Integrations.NovaPoshta;

internal static class NovaPoshtaText
{
    public static string Normalize(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        var result = new StringBuilder(value.Length);
        var pendingSpace = false;
        foreach (var ch in value.Trim())
        {
            if (char.IsWhiteSpace(ch))
            {
                pendingSpace = true;
                continue;
            }

            if (pendingSpace)
            {
                result.Append(' ');
                pendingSpace = false;
            }

            result.Append(ch switch
            {
                '’' or 'ʼ' or '‘' or 'ʻ' or '`' or '´' or '′' => '\'',
                _ => char.ToLowerInvariant(ch),
            });
        }

        return result.ToString();
    }

    public static string EscapeLike(string value) =>
        value.Replace("\\", "\\\\", StringComparison.Ordinal)
            .Replace("%", "\\%", StringComparison.Ordinal)
            .Replace("_", "\\_", StringComparison.Ordinal);

    public static string Truncate(string value, int max) => value.Length > max ? value[..max].TrimEnd() : value;
}

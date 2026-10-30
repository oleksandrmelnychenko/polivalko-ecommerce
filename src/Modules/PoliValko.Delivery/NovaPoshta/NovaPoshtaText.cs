using System.Text;

namespace PoliValko.Delivery.NovaPoshta;

/// <summary>Нормалізація назв для пошуку: однаково для збереженого стовпця й запиту покупця.</summary>
internal static class NovaPoshtaText
{
    /// <summary>
    /// Нижній регістр, один пробіл між словами, усі різновиди апострофа (’ ʼ ‘ `) → <c>'</c>:
    /// «Кам’янець» і «Кам'янець» мають знаходитися однаково.
    /// </summary>
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

    /// <summary>Екранує символи шаблону LIKE (<c>\</c>, <c>%</c>, <c>_</c>) з екрануванням через <c>\</c>.</summary>
    public static string EscapeLike(string value) =>
        value.Replace("\\", "\\\\", StringComparison.Ordinal)
            .Replace("%", "\\%", StringComparison.Ordinal)
            .Replace("_", "\\_", StringComparison.Ordinal);

    public static string Truncate(string value, int max) => value.Length > max ? value[..max].TrimEnd() : value;
}

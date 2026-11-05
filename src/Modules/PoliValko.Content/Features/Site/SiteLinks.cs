namespace PoliValko.Content.Features.Site;

internal static class SiteLinks
{
    public const string InvalidMessage = "Посилання має починатися з / або https://.";

    public static bool IsValid(string value)
    {
        if (value.Any(char.IsWhiteSpace) || value.Contains('\\'))
        {
            return false;
        }

        if (value.StartsWith('/'))
        {
            return !value.StartsWith("//", StringComparison.Ordinal);
        }

        return Uri.TryCreate(value, UriKind.Absolute, out var uri) && uri.Scheme is "https" or "http";
    }

    public static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}

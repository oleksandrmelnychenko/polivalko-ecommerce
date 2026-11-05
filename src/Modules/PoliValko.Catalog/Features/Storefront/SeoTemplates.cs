using System.Globalization;
using System.Text.RegularExpressions;
using PoliValko.Infrastructure.Settings;

namespace PoliValko.Catalog.Features.Storefront;

internal static partial class SeoTemplates
{
    public const string SettingsKey = "seo.templates";

    public const string ShopName = "Poli Valko";

    private static readonly NumberFormatInfo Ukrainian = new() { NumberGroupSeparator = " ", NumberDecimalSeparator = ",", NumberGroupSizes = [3] };

    public static async Task<Set> LoadAsync(ISettingsStore settings, CancellationToken ct) =>
        await settings.GetAsync<Set>(SettingsKey, ct) ?? new Set(null, null);

    public static (string? Title, string? Description) Fill(Pair? template, string? title, string? description, Values values) =>
        (Pick(title, template?.Title, values), Pick(description, template?.Description, values));

    public static string Price(decimal amount) => $"{amount.ToString(amount % 1 == 0 ? "N0" : "N2", Ukrainian)} грн";

    private static string? Pick(string? own, string? template, Values values)
    {
        if (!string.IsNullOrWhiteSpace(own) || string.IsNullOrWhiteSpace(template))
        {
            return own;
        }

        var text = template
            .Replace("{name}", values.Name, StringComparison.Ordinal)
            .Replace("{price}", values.Price ?? string.Empty, StringComparison.Ordinal)
            .Replace("{category}", values.Category ?? string.Empty, StringComparison.Ordinal)
            .Replace("{brand}", values.Brand ?? string.Empty, StringComparison.Ordinal)
            .Replace("{shop}", ShopName, StringComparison.Ordinal);
        text = Spaces().Replace(text, " ").Trim();
        return text.Length == 0 ? own : text;
    }

    [GeneratedRegex(@"\s{2,}")]
    private static partial Regex Spaces();

    internal sealed record Pair(string? Title, string? Description);

    internal sealed record Set(Pair? Product, Pair? Category);

    internal sealed record Values(string Name, string? Price, string? Category, string? Brand);
}

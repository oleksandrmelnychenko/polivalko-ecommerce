using System.Text.RegularExpressions;
using PoliValko.Infrastructure.Settings;

namespace PoliValko.Content.Features.Site;

internal static partial class SeoTemplateSettings
{
    public const string SettingsKey = "seo.templates";

    public const int MaxLength = 300;

    public static readonly IReadOnlyList<string> ProductTokens = ["name", "price", "category", "brand", "shop"];

    public static readonly IReadOnlyList<string> CategoryTokens = ["name", "category", "shop"];

    public static SeoTemplatesDto Defaults { get; } = new(
        new SeoTemplateDto(
            "{name}: ціна {price}, купити з доставкою",
            "{name} у магазині Poli Valko: ціна {price}, доставка Новою поштою по Україні або самовивіз з магазину."),
        new SeoTemplateDto(
            "{name}: купити з доставкою по Україні",
            "{name}: ціни, наявність і доставка по Україні."));

    public static async Task<SeoTemplatesDto> LoadAsync(ISettingsStore settings, CancellationToken ct)
    {
        var stored = await settings.GetAsync<Stored>(SettingsKey, ct);
        return stored is null ? Defaults : new SeoTemplatesDto(Pair(stored.Product), Pair(stored.Category));
    }

    public static IEnumerable<string> UnknownTokens(string template, IReadOnlyList<string> allowed) =>
        Token().Matches(template).Select(m => m.Groups[1].Value).Where(t => !allowed.Contains(t)).Distinct().Select(t => $"{{{t}}}");

    private static SeoTemplateDto Pair(StoredPair? pair) => new(pair?.Title ?? string.Empty, pair?.Description ?? string.Empty);

    [GeneratedRegex(@"\{([^{}]*)\}")]
    private static partial Regex Token();

    internal sealed record StoredPair(string? Title, string? Description);

    internal sealed record Stored(StoredPair? Product, StoredPair? Category);
}

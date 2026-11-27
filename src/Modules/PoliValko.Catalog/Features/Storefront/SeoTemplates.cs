using System.Globalization;
using System.Net;
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
        (Pick(title, template?.Title, values, isTitle: true), Pick(description, template?.Description, values, isTitle: false));

    /// <summary>Ціна для шаблону; у товару без ціни (0) — null, і шаблон із <c>{price}</c> не застосовується.</summary>
    public static string? Price(decimal amount) =>
        amount > 0 ? $"{amount.ToString(amount % 1 == 0 ? "N0" : "N2", Ukrainian)} грн" : null;

    public const int TitleMaxLengthWithoutShop = 52;
    public const int TitleMaxLengthWithShop = 65;
    public const int SnippetMinLength = 120;
    public const int SnippetMaxLength = 158;

    /// <summary>
    /// The start of the product description as a search snippet: plain text, cut at the last full sentence (or word)
    /// within 160 characters. Null when the text is too short to beat the template.
    /// </summary>
    public static string? DescriptionSnippet(string? html)
    {
        if (string.IsNullOrWhiteSpace(html))
        {
            return null;
        }

        var text = WebUtility.HtmlDecode(Tags().Replace(html, " "));
        text = AnySpace().Replace(text, " ").Trim();
        if (text.Length < SnippetMinLength)
        {
            return null;
        }

        if (text.Length <= SnippetMaxLength)
        {
            return text;
        }

        var head = text[..SnippetMaxLength];
        var sentence = head.LastIndexOfAny(['.', '!', '?']);
        if (sentence >= SnippetMinLength - 1)
        {
            return head[..(sentence + 1)];
        }

        var word = head[..(SnippetMaxLength - 1)].LastIndexOf(' ');
        return (word > 0 ? head[..word] : head[..(SnippetMaxLength - 1)]).TrimEnd(',', ';', ':') + "…";
    }

    private static string? Pick(string? own, string? template, Values values, bool isTitle)
    {
        if (!string.IsNullOrWhiteSpace(own) || string.IsNullOrWhiteSpace(template))
        {
            return own;
        }

        // Без ціни шаблон «ціна {price}» дав би «ціна 0 грн» або обірвану фразу, тому з шаблону вирізаємо
        // частину речення з ціною: «{name}: ціна {price}, купити з доставкою» → «{name}: купити з доставкою».
        if (values.Price is null && template.Contains("{price}", StringComparison.Ordinal))
        {
            template = WithoutPrice(template);
        }

        var text = template
            .Replace("{name}", values.Name, StringComparison.Ordinal)
            .Replace("{price}", values.Price ?? string.Empty, StringComparison.Ordinal)
            .Replace("{category}", values.Category ?? string.Empty, StringComparison.Ordinal)
            .Replace("{brand}", values.Brand ?? string.Empty, StringComparison.Ordinal)
            .Replace("{shop}", ShopName, StringComparison.Ordinal);
        text = Spaces().Replace(text, " ").Trim();
        if (text.Length == 0)
        {
            return own;
        }

        return isTitle ? GuardTitleLength(text, values.Name) : GuardDescriptionLength(text);
    }

    /// <summary>
    /// Keeps templated meta descriptions within the 158-char Google SERP bound without modifying shorter descriptions,
    /// preferring a sentence end at or after 120 chars and falling back to a clean word cut with an ellipsis.
    /// </summary>
    internal static string GuardDescriptionLength(string text)
    {
        var clean = Spaces().Replace(text, " ").Trim();
        if (clean.Length <= SnippetMaxLength)
        {
            return clean;
        }

        var head = clean[..SnippetMaxLength];
        var sentence = head.LastIndexOfAny(['.', '!', '?']);
        if (sentence >= SnippetMinLength - 1)
        {
            return head[..(sentence + 1)];
        }

        return ClipTitleCleanly(clean, SnippetMaxLength - 1) + "…";
    }

    /// <summary>
    /// Keeps templated SEO titles within Google SERP safe bounds (52 chars without shop suffix, 65 chars with shop suffix)
    /// by dropping boilerplate clauses first and then clipping cleanly at a word boundary.
    /// </summary>
    internal static string GuardTitleLength(string text, string fallbackName)
    {
        var clean = Spaces().Replace(text, " ").Trim();
        var shopMatch = ShopSuffix().Match(clean);
        var hasShop = shopMatch.Success;
        var maxLen = hasShop ? TitleMaxLengthWithShop : TitleMaxLengthWithoutShop;
        if (clean.Length <= maxLen)
        {
            return clean;
        }

        var suffix = hasShop ? shopMatch.Value : string.Empty;
        var budget = maxLen - suffix.Length;
        var body = hasShop ? clean[..^suffix.Length].Trim() : clean;

        var withoutBuy = BuyTail().Replace(body, string.Empty).Trim();
        if (withoutBuy.Length > 0 && withoutBuy.Length <= budget)
        {
            return withoutBuy + suffix;
        }

        if (withoutBuy.Length > 0)
        {
            body = withoutBuy;
        }

        var withoutPrice = PriceTail().Replace(body, string.Empty).Trim();
        if (withoutPrice.Length > 0 && withoutPrice.Length <= budget)
        {
            return withoutPrice + suffix;
        }

        if (withoutPrice.Length > 0)
        {
            body = withoutPrice;
        }

        var cleanName = Spaces().Replace(fallbackName, " ").Trim();
        if (cleanName.Length > 0 && cleanName.Length <= budget)
        {
            return cleanName + suffix;
        }

        return ClipTitleCleanly(body, budget) + suffix;
    }

    private static string ClipTitleCleanly(string text, int maxLen)
    {
        if (text.Length <= maxLen)
        {
            return text;
        }

        var slice = text[..Math.Min(text.Length, maxLen + 1)];
        var lastSpace = slice.LastIndexOf(' ');
        var cut = lastSpace > (int)(maxLen * 0.55) ? slice[..lastSpace] : text[..maxLen];
        cut = cut.TrimEnd(' ', '.', ',', ';', ':', '—', '–', '-', '/', '(', '«', '"');
        while (DanglingTail().IsMatch(cut))
        {
            cut = DanglingTail().Replace(cut, string.Empty).TrimEnd(' ', '.', ',', ';', ':', '—', '–', '-', '/', '(', '«', '"');
        }

        return cut;
    }

    /// <summary>Шаблон без фрагмента з <c>{price}</c> між розділовими знаками й без розділових знаків, що лишились зайвими.</summary>
    internal static string WithoutPrice(string template)
    {
        var text = PriceClause().Replace(template, " ");
        text = DanglingSeparator().Replace(text, string.Empty);
        return LeadingSeparators().Replace(text, string.Empty);
    }

    [GeneratedRegex(@"\s{2,}")]
    private static partial Regex Spaces();

    [GeneratedRegex(@"\s+")]
    private static partial Regex AnySpace();

    [GeneratedRegex("<[^>]*>")]
    private static partial Regex Tags();

    [GeneratedRegex(@"\s*[|—–-]\s*poli\s*valko[\s.!?»""')]*$", RegexOptions.IgnoreCase)]
    private static partial Regex ShopSuffix();

    [GeneratedRegex(@"\s*[,:;—–-]\s*купити(?:\s+з\s+доставкою|\s+в\s+україні|\s+в\s+бучі)?\s*$", RegexOptions.IgnoreCase)]
    private static partial Regex BuyTail();

    [GeneratedRegex(@"\s*[,:;—–-]\s*ціна\s+[\d\s,.]+грн\s*$", RegexOptions.IgnoreCase)]
    private static partial Regex PriceTail();

    [GeneratedRegex(@"\s+(?:в|у|з|із|зі|та|і|й|на|до|від|для|по|за|під|над|при|про|без)$", RegexOptions.IgnoreCase)]
    private static partial Regex DanglingTail();

    // A clause holding {price}: no other placeholder, no punctuation; a following comma or semicolon goes with it.
    [GeneratedRegex(@"\s*[^:;,.!?—–|{}]*\{price\}[^:;,.!?—–|{}]*(?:[,;]\s*)?")]
    private static partial Regex PriceClause();

    // A separator left with nothing after it: before another separator, before the end of the sentence or the text.
    [GeneratedRegex(@"\s*[:;,—–|](?=\s*[:;,.—–|]|\s*$)")]
    private static partial Regex DanglingSeparator();

    [GeneratedRegex(@"^[\s:;,.—–|]+")]
    private static partial Regex LeadingSeparators();

    internal sealed record Pair(string? Title, string? Description);

    internal sealed record Set(Pair? Product, Pair? Category);

    internal sealed record Values(string Name, string? Price, string? Category, string? Brand);
}

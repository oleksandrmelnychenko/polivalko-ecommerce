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
        (Pick(title, template?.Title, values), Pick(description, template?.Description, values));

    /// <summary>Ціна для шаблону; у товару без ціни (0) — null, і шаблон із <c>{price}</c> не застосовується.</summary>
    public static string? Price(decimal amount) =>
        amount > 0 ? $"{amount.ToString(amount % 1 == 0 ? "N0" : "N2", Ukrainian)} грн" : null;

    public const int SnippetMinLength = 120;
    public const int SnippetMaxLength = 160;

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

    private static string? Pick(string? own, string? template, Values values)
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
        return text.Length == 0 ? own : text;
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

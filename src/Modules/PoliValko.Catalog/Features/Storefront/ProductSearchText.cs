using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Domain;
using PoliValko.SharedKernel;

namespace PoliValko.Catalog.Features.Storefront;

internal static class ProductSearchText
{
    public const double MinSimilarity = 0.5;

    private const string Escape = "\\";
    private const int MaxWords = 6;
    private const int MinStemLength = 4;
    private const int MinSimilarLength = 3;

    private static readonly string[] Endings =
    [
        "ами", "ями", "ові", "еві", "єві", "ого", "ому", "ими", "іми",
        "ах", "ях", "ам", "ям", "ів", "їв", "ом", "ем", "єм", "ою", "ею", "єю",
        "ий", "ій", "ої", "их", "іх", "им", "ім", "ую", "юю",
        "а", "я", "о", "е", "є", "и", "і", "ї", "у", "ю", "ь", "й",
    ];

    private static readonly char[] Apostrophes = ['\'', '’', 'ʼ', '`'];

    private static readonly char[] Edges = ['.', ',', ';', ':', '!', '?', '(', ')', '[', ']', '«', '»', '"', '“', '”'];

    public static IReadOnlyList<string> Words(string term)
    {
        var words = term.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries)
            .Select(word => word.Trim(Edges).ToLowerInvariant())
            .Where(word => word.Length > 1 || (word.Length == 1 && char.IsAsciiDigit(word[0])))
            .Distinct()
            .Take(MaxWords)
            .ToList();
        return words.Count > 0 ? words : [term.ToLowerInvariant()];
    }

    public static string Stem(string word)
    {
        if (!word.All(c => IsCyrillic(c) || Apostrophes.Contains(c)))
        {
            return word;
        }

        foreach (var ending in Endings)
        {
            if (word.Length - ending.Length >= MinStemLength && word.EndsWith(ending, StringComparison.Ordinal))
            {
                return word[..^ending.Length];
            }
        }

        return word;
    }

    public static IQueryable<Product> Matching(IQueryable<Product> products, string term, IReadOnlyList<string> words)
    {
        foreach (var word in words)
        {
            var pattern = Like(Stem(word));
            products = IsLatin(word)
                ? products.Where(p => p.Sku == term
                    || EF.Functions.ILike(p.Name, pattern, Escape)
                    || (p.Brand != null && EF.Functions.ILike(p.Brand, pattern, Escape))
                    || EF.Functions.ILike(p.Slug, pattern, Escape))
                : products.Where(p => p.Sku == term
                    || EF.Functions.ILike(p.Name, pattern, Escape)
                    || (p.Brand != null && EF.Functions.ILike(p.Brand, pattern, Escape)));
        }

        return products;
    }

    public static IQueryable<Product>? Similar(IQueryable<Product> products, IReadOnlyList<string> words)
    {
        var similar = false;
        foreach (var word in words)
        {
            var stem = Stem(word);
            if (stem.Length < MinSimilarLength || stem.Any(char.IsAsciiDigit))
            {
                var pattern = Like(stem);
                products = products.Where(p => EF.Functions.ILike(p.Name, pattern, Escape));
                continue;
            }

            var slug = IsLatin(stem) ? stem : Transliteration.ToSlug(stem);
            products = products.Where(p => EF.Functions.TrigramsWordSimilarity(stem, p.Name) >= MinSimilarity
                || EF.Functions.TrigramsWordSimilarity(slug, p.Slug) >= MinSimilarity);
            similar = true;
        }

        return similar ? products : null;
    }

    private static string Like(string text)
    {
        var escaped = CategoryQueries.EscapeLike(text);
        foreach (var apostrophe in Apostrophes)
        {
            escaped = escaped.Replace(apostrophe, '_');
        }

        return $"%{escaped}%";
    }

    private static bool IsLatin(string word) =>
        word.Any(char.IsAsciiLetter) && word.All(c => char.IsAsciiLetterOrDigit(c) || c == '-');

    private static bool IsCyrillic(char c) => c is >= 'а' and <= 'я' or 'є' or 'і' or 'ї' or 'ґ';
}

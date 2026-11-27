using System.Collections.Concurrent;
using System.Text;
using PoliValko.Catalog.Domain;
using PoliValko.SharedKernel;

namespace PoliValko.Catalog.Features.Storefront;

/// <summary>The text of one product that search looks at.</summary>
internal sealed record SearchEntry(Guid Id, string Name, string? DisplayName, string? Brand, string Slug, string Sku, Guid CategoryId);

/// <summary>
/// What a query found: every product id, and the same ids split into groups from the best match down, the last group
/// left out (it is whatever is not in the others).
/// </summary>
/// <param name="About">Products whose name is about the first word («Шланг …», not «Перехідник для шланга»).</param>
internal sealed record SearchRanking(IReadOnlyList<Guid> Ids, IReadOnlyList<Guid[]> Better, IReadOnlyList<Guid> About, bool Approximate)
{
    public static readonly SearchRanking None = new([], [], [], false);
}

/// <summary>
/// Matches a shopper's words against product names, brands, sections, slugs and SKUs in memory, the way a person
/// would: any word form, Russian and colloquial words, the wrong keyboard layout, a typo, an extra word.
/// </summary>
internal static class ProductSearch
{
    private const int MaxWords = 6;
    private const int MinFuzzyLength = 4;
    private const int SkuTier = 100;
    private const int MaxParsed = 50_000;

    private static readonly ConcurrentDictionary<(SearchEntry Entry, string Category), Doc> Parsed = new();

    /// <summary>Words after which a name tells what the product is for, not what it is: «Перехідник для шланга».</summary>
    private static readonly HashSet<string> HeadEnds = ["для", "на", "до", "від", "під", "з", "із", "зі", "в", "у", "без"];

    private static readonly char[] Apostrophes = ['’', 'ʼ', '`', '‘'];
    private static readonly char[] Edges = ['.', ',', ';', ':', '!', '?', '(', ')', '[', ']', '«', '»', '"', '“', '”', '\'', '-', '+', '*'];

    public static SearchRanking Rank(string term, IReadOnlyList<SearchEntry> entries, IReadOnlyList<Category> categories)
    {
        var raw = term.Trim();
        if (raw.Length == 0) return SearchRanking.None;

        var docs = Documents(entries, categories);
        var found = Strict(raw, docs);
        if (found.Count > 0) return Build(found, approximate: false);

        foreach (var other in SearchVocabulary.OtherLayouts(raw))
        {
            found = Strict(other, docs);
            if (found.Count > 0) return Build(found, approximate: false);
        }

        found = Relaxed(raw, docs);
        return found.Count > 0 ? Build(found, approximate: true) : SearchRanking.None;
    }

    /// <summary>Lowercase with one spelling per letter: Russian letters and every apostrophe folded into Ukrainian ones.</summary>
    public static string Normalize(string text)
    {
        var sb = new StringBuilder(text.Length);
        foreach (var c in text.ToLowerInvariant())
        {
            sb.Append(c switch
            {
                'ё' or 'э' => 'е',
                'ы' => 'и',
                'ъ' => '\'',
                'ґ' => 'г',
                _ when Apostrophes.Contains(c) => '\'',
                _ => c,
            });
        }

        return sb.ToString();
    }

    public static string Stem(string word) => ProductSearchText.Stem(word);

    /// <summary>The words of a query that can narrow it: no punctuation, no single letters, no «для».</summary>
    public static IReadOnlyList<string> Words(string term) =>
        Normalize(term).Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries)
            .Select(word => word.Trim(Edges))
            .Where(word => word.Any(char.IsLetterOrDigit))
            .Where(word => word.Length > 1 || char.IsAsciiDigit(word[0]))
            .Where(word => !SearchVocabulary.StopWords.Contains(word))
            .Distinct()
            .Take(MaxWords)
            .ToList();

    private static List<Hit> Strict(string term, IReadOnlyList<Doc> docs)
    {
        var sku = Normalize(term);
        var words = Words(term).Select(Query.Of).ToList();
        var hits = new List<Hit>();
        foreach (var doc in docs)
        {
            if (doc.Sku == sku)
            {
                hits.Add(new Hit(doc.Id, SkuTier, About: true));
                continue;
            }

            if (words.Count == 0) continue;
            var levels = words.Select(word => word.Match(doc)).ToList();
            if (levels.Any(level => level is null)) continue;
            hits.Add(new Hit(doc.Id, levels.Min(level => level!.Value), words[0].About(doc)));
        }

        return hits;
    }

    /// <summary>
    /// Words that find nothing are taken as typos of catalog words or dropped; when the rest do not all meet in one
    /// product, products are ranked by how many of them they have.
    /// </summary>
    private static List<Hit> Relaxed(string term, IReadOnlyList<Doc> docs)
    {
        var words = new List<Query>();
        HashSet<string>? vocabulary = null;
        foreach (var word in Words(term).Select(Query.Of))
        {
            if (docs.Any(doc => word.Match(doc) is not null))
            {
                words.Add(word);
                continue;
            }

            vocabulary ??= docs.SelectMany(doc => doc.Tokens).ToHashSet();
            if (word.Fuzzy(vocabulary) is { } similar) words.Add(similar);
        }

        if (words.Count == 0) return [];

        var hits = new List<Hit>();
        foreach (var doc in docs)
        {
            var levels = words.Select(word => word.Match(doc)).ToList();
            var matched = levels.Count(level => level is not null);
            if (matched == 0) continue;
            var best = levels.Where(level => level is not null).Min(level => level!.Value);
            hits.Add(new Hit(doc.Id, matched * 10 + best, words[0].About(doc)));
        }

        // When every remaining word meets in some product, only those products count.
        var all = words.Count * 10;
        return hits.Any(hit => hit.Tier >= all) ? hits.Where(hit => hit.Tier >= all).ToList() : hits;
    }

    private static SearchRanking Build(List<Hit> hits, bool approximate)
    {
        var tiers = hits.GroupBy(hit => hit.Tier).OrderByDescending(group => group.Key)
            .Select(group => group.Select(hit => hit.Id).ToArray()).ToList();
        return new SearchRanking(hits.Select(hit => hit.Id).ToList(), tiers.Take(tiers.Count - 1).ToList(),
            hits.Where(hit => hit.About).Select(hit => hit.Id).ToList(), approximate);
    }

    private static List<Doc> Documents(IReadOnlyList<SearchEntry> entries, IReadOnlyList<Category> categories)
    {
        var byId = categories.ToDictionary(c => c.Id);
        var paths = new Dictionary<Guid, string>();
        string PathOf(Guid id)
        {
            if (paths.TryGetValue(id, out var known)) return known;
            var names = new List<string>();
            for (Guid? current = id; current is { } at && byId.TryGetValue(at, out var category) && names.Count < 10; current = category.ParentId)
            {
                names.Add(category.Name);
            }

            return paths[id] = Normalize(string.Join(' ', names));
        }

        // A product's text changes rarely, so its parsed form is kept for the next keystroke; any edit is a new key.
        if (Parsed.Count > MaxParsed) Parsed.Clear();
        return entries.Select(e => Parsed.GetOrAdd((e, PathOf(e.CategoryId)), key => Doc.Of(key.Entry, key.Category))).ToList();
    }

    private sealed record Hit(Guid Id, int Tier, bool About);

    private sealed class Doc
    {
        public required Guid Id { get; init; }
        public required string Name { get; init; }
        public required string[] NameTokens { get; init; }
        public required string[] Head { get; init; }
        public required string Brand { get; init; }
        public required string Category { get; init; }
        public required string Slug { get; init; }
        public required string[] SlugTokens { get; init; }
        public required string Sku { get; init; }
        public required string[] Tokens { get; init; }

        public static Doc Of(SearchEntry e, string category)
        {
            var shown = Normalize(e.DisplayName ?? e.Name);
            var name = e.DisplayName is null ? shown : $"{shown} {Normalize(e.Name)}";
            var nameTokens = Split(name);
            var brand = Normalize(e.Brand ?? string.Empty);
            var slug = e.Slug.ToLowerInvariant();
            var slugTokens = slug.Split('-', StringSplitOptions.RemoveEmptyEntries);
            return new Doc
            {
                Id = e.Id,
                Name = name,
                NameTokens = nameTokens,
                Head = Split(shown).TakeWhile(token => !HeadEnds.Contains(token)).ToArray(),
                Brand = brand,
                Category = category,
                Slug = slug,
                SlugTokens = slugTokens,
                Sku = Normalize(e.Sku.Trim()),
                Tokens = [.. nameTokens, .. Split(brand), .. Split(category), .. slugTokens],
            };
        }

        private static string[] Split(string text)
        {
            var tokens = new List<string>();
            var sb = new StringBuilder();
            foreach (var c in text)
            {
                if (char.IsLetterOrDigit(c) || c is '\'' or '/' or '.' or ',')
                {
                    sb.Append(c);
                    continue;
                }

                Flush();
            }

            Flush();
            return tokens.ToArray();

            void Flush()
            {
                var token = sb.ToString().Trim('.', ',', '\'');
                if (token.Length > 0) tokens.Add(token);
                sb.Clear();
            }
        }
    }

    /// <param name="Penalty">0 for the word itself, 1 for a synonym or a similar word.</param>
    /// <param name="WholeToken">A similar word from the catalog must be a whole word; a stem may start any word.</param>
    private sealed record Variant(string Text, int Penalty, bool WholeToken);

    private sealed record Query(string Word, string Stem, IReadOnlyList<Variant> Variants, bool Latin)
    {
        public static Query Of(string word)
        {
            var stem = ProductSearch.Stem(word);
            var variants = new List<Variant> { new(stem, 0, false) };
            variants.AddRange(SearchVocabulary.Synonyms(stem).Select(synonym => new Variant(synonym, 1, false)));
            return new Query(word, stem, variants, IsLatin(word));
        }

        /// <summary>
        /// How well the word is in the product name: 3 a form of a name word («газону» for «газон»), 2 the start of a
        /// longer one («газонокосарка»), 1 inside a word, 0 only in the brand, section or SKU; null when nowhere.
        /// </summary>
        public int? Match(Doc doc)
        {
            int? best = null;
            foreach (var variant in Variants)
            {
                var level = Level(doc, variant);
                if (level is { } found && (best is null || found > best)) best = found;
                if (best == WordForm) break;
            }

            return best;
        }

        /// <summary>Whether the word is among the name's words before «для», «на» and the like.</summary>
        public bool About(Doc doc) => Variants.Any(variant => doc.Head.Any(token => variant.WholeToken
            ? token == variant.Text
            : token.StartsWith(variant.Text, StringComparison.Ordinal)));

        private const int WordForm = 3;
        private const int MinInsideLength = 4;
        private const int MaxEndingLength = 3;

        private int? Level(Doc doc, Variant variant)
        {
            var text = variant.Text;
            if (variant.WholeToken)
            {
                if (doc.NameTokens.Contains(text) || doc.SlugTokens.Contains(text)) return WordForm;
                return doc.Tokens.Contains(text) ? 0 : null;
            }

            var prefix = 0;
            foreach (var token in doc.NameTokens)
            {
                if (!token.StartsWith(text, StringComparison.Ordinal)) continue;
                prefix = token.Length - text.Length <= MaxEndingLength ? WordForm : 2;
                if (prefix == WordForm) break;
            }

            if (prefix > 0) return prefix;
            if (Latin && doc.Slug.Contains(text, StringComparison.Ordinal)) return WordForm;
            // A synonym inside another word is more often a different word («роза» in «мороза»).
            // Inside a word only for words long enough to mean something there: «тли» is in «світлий».
            if (variant.Penalty == 0 && text.Length >= MinInsideLength && doc.Name.Contains(text, StringComparison.Ordinal)) return 1;
            if (doc.Brand.Contains(text, StringComparison.Ordinal)) return 0;
            if (WordIn(doc.Category, text)) return 0;
            if (variant.Penalty == 0 && text.Length >= 3 && doc.Sku.StartsWith(text, StringComparison.Ordinal)) return 0;
            return null;
        }

        /// <summary>The catalog words one or two letters away from this one, also across Latin and Cyrillic.</summary>
        public Query? Fuzzy(IReadOnlySet<string> vocabulary)
        {
            if (Stem.Length < MinFuzzyLength || Stem.Any(char.IsAsciiDigit)) return null;
            var forms = new List<string> { Stem };
            if (!Latin) forms.Add(Transliteration.ToSlug(Stem));
            var similar = vocabulary.Where(token => forms.Any(form => Close(form, token))).ToList();
            return similar.Count == 0 ? null : this with { Variants = similar.Select(token => new Variant(token, 1, true)).ToList() };
        }

        private static bool Close(string stem, string token)
        {
            // People rarely miss the first letter, and checking it first keeps this fast on every keystroke.
            if (token.Length < MinFuzzyLength || token.Length < stem.Length - 1 || token[0] != stem[0]) return false;
            var allowed = stem.Length >= 7 ? 2 : 1;
            for (var length = Math.Max(MinFuzzyLength, stem.Length - 1); length <= Math.Min(token.Length, stem.Length + 1); length++)
            {
                if (Distance(stem, token[..length], allowed) <= allowed) return true;
            }

            return false;
        }

        private static bool IsLatin(string word) =>
            word.Any(char.IsAsciiLetter) && word.All(c => char.IsAsciiLetterOrDigit(c) || c == '-');
    }

    /// <summary>Edits between two words, a swap of neighbours counting once; stops early past <paramref name="limit"/>.</summary>
    internal static int Distance(string a, string b, int limit = int.MaxValue)
    {
        if (Math.Abs(a.Length - b.Length) > limit) return limit + 1;
        var d = new int[a.Length + 1, b.Length + 1];
        for (var i = 0; i <= a.Length; i++) d[i, 0] = i;
        for (var j = 0; j <= b.Length; j++) d[0, j] = j;
        for (var i = 1; i <= a.Length; i++)
        {
            var rowMin = int.MaxValue;
            for (var j = 1; j <= b.Length; j++)
            {
                var cost = a[i - 1] == b[j - 1] ? 0 : 1;
                d[i, j] = Math.Min(Math.Min(d[i - 1, j] + 1, d[i, j - 1] + 1), d[i - 1, j - 1] + cost);
                if (i > 1 && j > 1 && a[i - 1] == b[j - 2] && a[i - 2] == b[j - 1])
                {
                    d[i, j] = Math.Min(d[i, j], d[i - 2, j - 2] + 1);
                }

                rowMin = Math.Min(rowMin, d[i, j]);
            }

            if (rowMin > limit) return limit + 1;
        }

        return d[a.Length, b.Length];
    }

    private static bool WordIn(string text, string stem)
    {
        for (var at = text.IndexOf(stem, StringComparison.Ordinal); at >= 0; at = text.IndexOf(stem, at + 1, StringComparison.Ordinal))
        {
            if (at == 0 || !char.IsLetterOrDigit(text[at - 1])) return true;
        }

        return false;
    }
}

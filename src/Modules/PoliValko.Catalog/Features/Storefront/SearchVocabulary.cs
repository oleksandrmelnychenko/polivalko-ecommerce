namespace PoliValko.Catalog.Features.Storefront;

/// <summary>Words a shopper types that the catalog names differently: Russian, colloquial, other spellings.</summary>
internal static class SearchVocabulary
{
    /// <summary>Words that never narrow a search: a product is not «для» anything in its name.</summary>
    public static readonly HashSet<string> StopWords =
    [
        "для", "на", "з", "із", "зі", "і", "й", "та", "в", "у", "до", "по", "під", "від", "без", "або", "чи",
        "що", "як", "the", "and", "for", "with", "и", "с", "со", "от", "к", "из", "или", "по", "под",
    ];

    /// <summary>Each line is one thing; any word of a line also finds the others.</summary>
    private static readonly string[][] Groups =
    [
        ["насіння", "семена", "семя", "насінини"],
        ["добриво", "удобрение", "удобрения", "підживлення", "подкормка"],
        ["граблі", "грабли"],
        ["лійка", "лейка"],
        ["відро", "ведро"],
        ["рукавички", "рукавиці", "перчатки"],
        ["обприскувач", "оприскувач", "опрыскиватель", "обприскиватель"],
        ["розпилювач", "распылитель", "насадка"],
        ["газонокосарка", "косарка", "косилка", "газонокосилка"],
        ["тример", "триммер", "мотокоса", "тріммер"],
        ["дощувач", "зрошувач", "разбрызгиватель", "поливалка", "спринклер"],
        ["ножиці", "ножницы"],
        ["сокира", "топор", "колун"],
        ["пила", "пилка", "ножівка", "ножовка"],
        ["тачка", "візок", "тележка", "тачку"],
        ["горщик", "горшок", "кашпо"],
        ["грунт", "земля", "почва", "субстрат"],
        ["томат", "помідор", "помидор"],
        // «огірок» becomes «огірки»: a vowel that changes inside the word is beyond a suffix stemmer.
        ["огірок", "огірки", "огурец", "огурцы", "огурцов"],
        ["розсада", "рассада"],
        ["поливальний", "поливочный", "полив"],
        ["кабачок", "кабачки"],
        ["кошик", "кошики", "корзина"],
        ["вінок", "вінки", "венок"],
        ["молоток", "молотки"],
        ["совок", "совки"],
        ["морква", "морковь"],
        ["буряк", "свекла", "бурак"],
        ["цибуля", "лук"],
        ["часник", "чеснок"],
        ["кріп", "укроп"],
        ["гарбуз", "тыква"],
        ["кавун", "арбуз"],
        ["диня", "дыня"],
        ["перець", "перец"],
        ["квасоля", "фасоль"],
        ["кукурудза", "кукуруза"],
        ["картопля", "картофель", "картошка"],
        ["полуниця", "суниця", "клубника", "земляника"],
        ["квіти", "цветы", "цветок", "квітка"],
        ["троянда", "роза", "розы"],
        ["ялинка", "елка", "ялина", "елочка"],
        ["гірлянда", "гирлянда"],
        ["іграшка", "игрушка"],
        ["мангал", "гриль", "барбекю"],
        ["вугілля", "уголь"],
        ["розпалювач", "розжиг", "розпалювання"],
        ["басейн", "бассейн"],
        ["шкідник", "вредитель"],
        ["бур'ян", "сорняк"],
        ["компост", "компостер"],
        ["агроволокно", "спанбонд", "агроткань", "агроволокна"],
        ["обігрівач", "обогреватель", "нагрівач"],
        ["годівниця", "кормушка"],
        ["шпаківня", "скворечник"],
        ["з'єднувач", "соединитель", "конектор", "коннектор"],
        ["крапельний", "капельный", "крапельна", "капельная"],
        ["пістолет", "пистолет"],
        ["щітка", "щетка"],
        ["мітла", "метла", "віник", "веник"],
        ["сапка", "тяпка", "сапа"],
        ["сітка", "сетка"],
        ["плівка", "пленка"],
        ["мотузка", "веревка", "шпагат"],
        ["ліхтар", "фонарь", "світильник"],
        ["кущоріз", "кусторез"],
        ["сучкоріз", "сучкорез", "гілкоріз"],
        ["шланг", "шланги"],
        ["лопата", "лопатка"],
        ["кран", "вентиль"],
        ["таймер", "контролер", "контроллер"],
    ];

    private static readonly List<string[]> StemGroups =
        Groups.Select(group => group.Select(word => ProductSearch.Stem(ProductSearch.Normalize(word))).Distinct().ToArray()).ToList();

    /// <summary>The stems a word stands for besides its own.</summary>
    public static IEnumerable<string> Synonyms(string stem) =>
        StemGroups.Where(group => group.Any(member => Related(stem, member)))
            .SelectMany(group => group)
            .Where(member => member != stem)
            .Distinct();

    /// <summary>The same word in another form («удобрен» and «удобрени»), not a longer word («газон» and «газонокосарк»).</summary>
    private static bool Related(string a, string b) =>
        a == b
        || (Math.Min(a.Length, b.Length) >= 4 && Math.Abs(a.Length - b.Length) <= 2
            && (a.StartsWith(b, StringComparison.Ordinal) || b.StartsWith(a, StringComparison.Ordinal)))
        // Short words keep their ending through the stemmer: «елку» and «елка».
        || (a.Length == b.Length && a.Length >= 4 && a[..^1] == b[..^1] && IsVowel(a[^1]) && IsVowel(b[^1]));

    private static bool IsVowel(char c) => "аеєиіїоуюя".Contains(c);

    // The Russian layout differs in four keys; its letters map back to Latin too.
    private const string Latin = "qwertyuiop[]asdfghjkl;'zxcvbnm,.`";
    private const string Ukrainian = "йцукенгшщзхїфівапролджєячсмитьбю'";
    private const string Cyrillic = Ukrainian + "ыэъё";
    private const string FromCyrillic = Latin + "s']`";

    /// <summary>The same keys pressed on the other keyboard layout: «ufpjy» is «газон», «пфквуфт» is «gardena».</summary>
    public static IEnumerable<string> OtherLayouts(string term)
    {
        var lower = term.ToLowerInvariant();
        string[] others =
        [
            .. lower.Any(char.IsAsciiLetter) ? [Map(lower, Latin, Ukrainian)] : Array.Empty<string>(),
            .. lower.Any(c => Cyrillic.Contains(c) && char.IsLetter(c)) ? [Map(lower, Cyrillic, FromCyrillic)] : Array.Empty<string>(),
        ];
        // «жжж» would become «;;;»: a layout swap that leaves punctuation inside was not one.
        return others.Where(other => other.All(c => char.IsLetterOrDigit(c) || char.IsWhiteSpace(c) || c is '-' or '\'' or '/'));
    }

    private static string Map(string text, string from, string to) =>
        string.Concat(text.Select(c => from.IndexOf(c) is var i and >= 0 ? to[i] : c));
}

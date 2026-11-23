using System.Numerics;
using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using PoliValko.Catalog.Domain;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Catalog.Features.Storefront;

internal static class SeasonalPurpose
{
    internal sealed record Match(Guid ProductId, int? Family, int MonthMask);
    /// <summary>Which rules name each product: bit i stands for rule i of the table. It does not depend on the day.</summary>
    internal sealed record RuleMatches(Guid[] ProductIds, long[] Rules);
    private sealed record Found(Guid ProductId, long Rules);
    private sealed record Rule(string Family, int From, int Through, string[] Sections, string Include, string? Exclude = null)
    {
        public bool Applies(int month) => From <= Through ? month >= From && month <= Through : month >= From || month <= Through;
        public int MonthMask { get; } = Enumerable.Range(From, (Through - From + 12) % 12 + 1)
            .Sum(month => 1 << ((month - 1) % 12));
    }

    private const string Covers = "Укривні матеріали";
    private const string Pruning = "Гілкорізи/Сучкорізи/Секатори/Ножиці";
    private const string WinterCare = "Прибирання снігу й льоду";
    // The catalog renamed these sections on 23.11.2026. A rule finds its section under either name.
    private static readonly Dictionary<string, string> Renamed = new()
    {
        [Pruning] = "Секатори, сучкорізи й ножиці",
        ["Сокири/Пили/Ножі"] = "Сокири, пили й ножі",
        ["Септик/Компост"] = "Септики й компост",
        ["Оприскувачі/Лійки/Відра"] = "Оприскувачі, лійки й відра",
        ["Бордюрні стрічки"] = "Бордюри й огорожі",
    };
    private static readonly SemaphoreSlim Matching = new(1, 1);
    private static readonly string[] Attributes = ["тип", "тип товару", "призначення", "тематика", "культура", "сезон", "сезонність", "період застосування", "сезон застосування"];

    // Inclusive months describe storefront priorities. Match only inside the named catalog branches.
    private static readonly Rule[] Rules =
    [
        // Everything in the New Year department, whatever it is called: its goods have no other season.
        new("novyi-rik", 11, 12, ["novyi-rik"], "."),
        new("Обігрівачі", 10, 3, ["Обігрівачі"], "обігрів|обігрівач|нагрівач|конвектор|тепловентилятор"),
        new("Годівниці", 10, 3, ["Годівниці"], "годівниц|годівл.*птах|годуван.*птах"),
        new("Годівниці", 2, 4, ["Годівниці"], "шпаківн|синичник|гніздівл|будиночок для птах"),
        new(Covers, 9, 4, [Covers], "чох.*(рослин|троянд)|агроволокн.*біл|біл.*агроволокн|від (за)?мороз", "чорн.*біл|біл.*чорн"),
        new(Covers, 5, 8, [Covers], "^(сіт.*затін|затін.*сіт)", "кліпс|затискач"),
        new(WinterCare, 11, 2, ["Ручний інструмент", "Все для прибирання", "Автотовари"],
            // In these sections anything about snow is a tool for it, however the name is worded.
            "сніг|антилід|протилід|ожелед|для доріг|зимов.*омивач|омивач.*зимов|скребок.*льод"),
        new("Насіння", 1, 3, ["Насіння"], "перець|баклажан|селер|петуні|лобелі", "томат|помідор"),
        new("Насіння", 2, 4, ["Насіння"], "розсад|томат|помідор"),
        new("Насіння", 3, 5, ["Насіння"], "огірок|огірк|моркв|редис|буряк|кабачок|гарбуз|кавун|капуст|горох|квасол|салат|кріп|петрушк|шпинат"),
        new("Насіння", 8, 10, ["Насіння"], "сидерат|підзимов.*(посів|висів)|озим.*(посів|висів)"),
        new("Грунти та добавки", 1, 5, ["Грунти та добавки"], "розсад|для посів|для висів|пророщ|пікіруван|агроперліт|вермикуліт|кокосовий брикет", "для орхідей|кокосові чіпси"),
        new("Горщики", 2, 5, ["Горщики"], "розсад|торф.?(яний|яні|яна)|для посів|для висів|касет.*(посад|вирощ)"),
        new("Горщики", 9, 11, ["Горщики"], "для цибул(ин|ев)|для посадки цибул"),
        new("Добрива", 8, 11, ["Добрива"], "осін|підготовк.*до зими"),
        new("Добрива", 2, 5, ["Добрива"], "розсад|веснян|укорін|вкорін", "осін"),
        new("Добрива", 5, 8, ["Добрива"], "для газон|для квітуч|цвітіння|плодоношення|літн", "осін|підготовк.*до зими"),
        new("Насіння газонних трав", 3, 5, ["Насіння газонних трав"], "газон|газонн.*трав|конюшин"),
        new("Насіння газонних трав", 8, 10, ["Насіння газонних трав"], "газон|газонн.*трав|конюшин"),
        new("Композитні грядки", 3, 5, ["Композитні грядки"], "грядк"),
        new("Посадка", 3, 5, ["Ручний інструмент"], "сіялк|саджалк|для (ви)?сад(жування|ки)|для посадки|лопатка садова|садова лопатка"),
        new("Посадка", 9, 10, ["Ручний інструмент"], "для (висад(ки|жування)|посадки) цибул|саджалка.*цибул"),
        new("Облаштування саду", 4, 6, ["Бордюрні стрічки", "Рослини"], "садовий бордюр|бордюр садовий|газонне огородження|рулонний газон"),
        new(Pruning, 2, 3, [Pruning, "Сокири/Пили/Ножі"], "секатор|сучкоріз|гілкоріз|обріз(к|у)|пил[ак].*садов|садов.*пил"),
        new(Pruning, 9, 10, [Pruning, "Сокири/Пили/Ножі"], "секатор|сучкоріз|гілкоріз|обріз(к|у)|пил[ак].*садов|садов.*пил"),
        new("Все для прибирання", 9, 11, ["Все для прибирання", "Ручний інструмент"], "для листя|віялов.*грабл|граблі.*віял|збирання листя"),
        new("Збирання врожаю", 8, 10, ["Матеріали для пакування", "Ручний інструмент"], "мішок овочев|овочева сітка|сітка для овочів|плодознімач"),
        new("Септик/Компост", 9, 11, ["Септик/Компост", "Господарчі товари", "Ручний інструмент"], "компостер|для компост|компостуван"),
        new("Догляд за деревами", 10, 11, ["Засоби захисту рослин"], "побілк|для побілки|фарба для дерев"),
        new("Догляд за деревами", 2, 3, ["Засоби захисту рослин"], "побілк|для побілки|фарба для дерев"),
        new("Захист рослин у період вегетації", 3, 4, ["Засоби захисту рослин"], "фунгіцид|медян екстра", "протруйник|для зберігання|для сховищ"),
        new("Захист рослин у період вегетації", 5, 9, ["Засоби захисту рослин"],
            "інсектицид|фунгіцид|прилипач", "протруйник|для зберігання|для сховищ"),
        new("Добрива", 2, 5, ["Засоби захисту рослин", "Добрива"], "стимулятор коренеутворення"),
        new("Добрива", 9, 11, ["Добрива"], "суперфосфат"),
        new("Догляд за деревами", 10, 11, ["Засоби захисту рослин"], "залізний купорос"),
        new("vse-dlia-polyvu", 4, 8, ["vse-dlia-polyvu"], "^(набір для поливу|поливальний комплект|система туманоутворення)"),
        new("vse-dlia-polyvu", 4, 8, ["vse-dlia-polyvu"],
            "шланг|зрошувач|дощувач|розбризк|спринклер|крапельна (стрічка|труба)|емітерна.*стрічка|поливальн.*комплект|пістолет.*(полив|розпил)",
            "прапорець|муфта|трійник|адаптер|перехідник|з.?єдн|конектор|заглушк|корпус|штуцер|хомут|ніпель|продув|консервац|без (вбудованих )?крапельниць|для підключення"),
        new("Консервація поливу", 10, 11, ["vse-dlia-polyvu"], "продув|консервац.*(полив|зрош)"),
        new("vse-dlia-vidpochynku", 5, 8, ["vse-dlia-vidpochynku"], "гамак|мангал|шампур|шомпур|барбекю|грил|пікнік|ізотерм|акумулятор холоду|сумка.холодильник|шезлонг|кемпінг", "роздмухувач"),
        new("Хімія для басейнів", 5, 8, ["Хімія для басейнів"], "басейн|хлор|альгекс|флокер|коагул|тест.*води", "консервац|зимівл|зимов"),
        new("Хімія для басейнів", 9, 10, ["Хімія для басейнів"], "консервац|зимівл|зимов"),
        new("Догляд за газоном", 4, 9, ["Техніка для саду та городу", "Ручний інструмент"], "газонокос|мотокос|тример|ножиці для трав|аератор.*газон", "ліска|волосін|корд для|котушк|шпул|головка для|ніж для|запасн"),
        new("Догляд за рослинами", 4, 8, ["Опори для рослин", "Оприскувачі/Лійки/Відра"], "шпалер|опор.*(рослин|бамбук)|підв.яз|обприскувач|оприскувач|лійка.*садов"),
        new("Захист від комах", 5, 9, ["Засоби захисту людей"], "комар|кліщ|москіт|репелент"),
        new("Садове освітлення", 4, 8, ["Елементи освітлення"], "світильник.*сонячн|сонячн.*світильник|освітлення садов.*доріж"),
        // Three years of receipts: traps and poison sell 1.7–2.2 times their monthly average from August to November.
        // The section is mostly insect control with a summer season, so its history cannot speak for them.
        new("Захист від гризунів", 8, 11, ["Шкідники"], "миш|щур|гризун|пацюк|родентицид|щелкунчик|шах і мат", "крот|кріт"),
    ];

    /// <summary>
    /// Every product a rule names for any month. Family is set while one of its rules is in force and is the place
    /// of that family among the first twelve; MonthMask holds all its months, so a product whose season is another
    /// time of the year can be told from one without a season. Families counts the families in force.
    /// </summary>
    public static (IQueryable<Match> Rows, int Families) Matches(PoliValkoDbContext db, RuleMatches matches,
        IReadOnlyList<Category> categories, DateOnly day)
    {
        var (rows, families) = Read(matches, categories, day);
        return (Rows(db, rows), families);
    }

    /// <summary>The months of every product a rule names. No day and no tree: families play no part in it.</summary>
    public static IQueryable<Match> Calendar(PoliValkoDbContext db, RuleMatches matches) =>
        Rows(db, Read(matches, [], default).Rows);

    /// <summary>
    /// Which rules name each product. Matching the whole rule table against the catalog is costly, and the answer
    /// changes only with the catalog, so it is kept until a name, a section, an attribute or the tree changes.
    /// </summary>
    public static async Task<RuleMatches> LoadAsync(PoliValkoDbContext db, IMemoryCache cache,
        IReadOnlyList<Category> categories, CancellationToken ct)
    {
        var catalog = await CatalogStateAsync(db, ct);
        return await CachedLoad.GetAsync(cache, ("storefront-rule-matches", Signature(categories), catalog), Matching,
            TimeSpan.FromMinutes(30), async () =>
            {
                var matches = await MatchAsync(db, categories, ct);
                // A catalog that changed while the rules were being matched may have given these matches.
                // They serve this request; the next one matches again.
                return (matches, await CatalogStateAsync(db, ct) == catalog);
            }, ct);
    }

    /// <summary>
    /// Everything the matching reads, in one cheap pass over the catalog: published products with their names
    /// and sections, and the attributes the rules look at.
    /// </summary>
    private static Task<string> CatalogStateAsync(PoliValkoDbContext db, CancellationToken ct) =>
        db.Database.SqlQuery<string>($"""
            SELECT (SELECT count(*)::text || ':' || coalesce(sum(hashtextextended(
                        p.id::text || p.category_id::text || coalesce(p.display_name,p.name), 0)), 0)::text
                    FROM catalog.products p WHERE p.is_visible AND NOT p.is_archived)
                || '|' ||
                   (SELECT count(*)::text || ':' || coalesce(sum(hashtextextended(
                        a.product_id::text || lower(a.name) || '=' || a.value, 0)), 0)::text
                    FROM catalog.product_attributes a WHERE lower(a.name) = ANY({Attributes})) AS "Value"
            """).SingleAsync(ct);

    /// <summary>
    /// Sections the rules name that the catalog does not have, for instance after a section was renamed.
    /// Their goods have lost those rules, even when the rule still finds another of its sections.
    /// </summary>
    public static IReadOnlyList<string> MissingSections(IReadOnlyList<Category> categories) =>
        Rules.SelectMany(rule => rule.Sections).Distinct()
            .Where(section => !categories.Any(category => Named(category, section)))
            .Select(section => Renamed.TryGetValue(section, out var now) ? $"{section} / {now}" : section).ToArray();

    /// <summary>A rule names a section by its title or its address; a renamed section answers to both titles.</summary>
    private static bool Named(Category category, string section) =>
        category.Name == section || category.Slug == section
        || (Renamed.TryGetValue(section, out var now) && category.Name == now);

    private static string Signature(IReadOnlyList<Category> categories) => Convert.ToHexString(SHA256.HashData(
        Encoding.UTF8.GetBytes(string.Join("\n", categories.Select(c => $"{c.Id}|{c.ParentId}|{c.Slug}|{c.Name}")))));

    private static int[] InForce(DateOnly day)
    {
        string[] leadingTasks = day.Month switch
        {
            1 => ["Обігрівачі", WinterCare, "Годівниці", "Насіння", "Грунти та добавки"],
            4 => ["Насіння", "Посадка", "Горщики", "Грунти та добавки", "vse-dlia-polyvu"],
            8 => ["Збирання врожаю", "vse-dlia-polyvu", Covers, "Насіння"],
            9 => ["Збирання врожаю", "Насіння газонних трав", "Добрива", "Насіння", "Септик/Компост"],
            10 => [Covers, "Все для прибирання", "Консервація поливу", "Збирання врожаю", "Догляд за деревами"],
            _ => SeasonalMerchandising.LeadingFamilies(day),
        };
        var priority = leadingTasks.Select((key, i) => (key, i)).ToDictionary(x => x.key, x => x.i);
        return Enumerable.Range(0, Rules.Length).Where(rule => Rules[rule].Applies(day.Month))
            .OrderBy(rule => priority.GetValueOrDefault(Rules[rule].Family, priority.Count)).ToArray();
    }

    /// <summary>What the kept matches mean on one day: the family of each product among the rules in force, and all its months.</summary>
    private static (Match[] Rows, int Families) Read(RuleMatches matches, IReadOnlyList<Category> categories, DateOnly day)
    {
        // Families enter the first twelve in this order. A rule whose sections the catalog lacks brings no family.
        var groups = new List<string>();
        var family = new int?[Rules.Length];
        foreach (var rule in InForce(day))
        {
            if (!categories.Any(category => Rules[rule].Sections.Any(section => Named(category, section)))) continue;
            if (!groups.Contains(Rules[rule].Family)) groups.Add(Rules[rule].Family);
            family[rule] = groups.IndexOf(Rules[rule].Family);
        }
        var rows = new Match[matches.ProductIds.Length];
        for (var i = 0; i < rows.Length; i++)
        {
            int? first = null;
            var months = 0;
            for (var left = matches.Rules[i]; left != 0; left &= left - 1)
            {
                var rule = BitOperations.TrailingZeroCount(left);
                months |= Rules[rule].MonthMask;
                if (family[rule] is { } place && (first is null || place < first)) first = place;
            }
            rows[i] = new Match(matches.ProductIds[i], first, months);
        }
        return (rows, groups.Count);
    }

    private static IQueryable<Match> Rows(PoliValkoDbContext db, IReadOnlyCollection<Match> rows)
    {
        var ids = rows.Select(row => row.ProductId).ToArray();
        var families = rows.Select(row => row.Family).ToArray();
        var masks = rows.Select(row => row.MonthMask).ToArray();
        return db.Database.SqlQuery<Match>($"""
            SELECT id AS product_id, family, month_mask
            FROM unnest({ids}::uuid[], {families}::int[], {masks}::int[]) AS m(id, family, month_mask)
            WHERE {RowSets.Rules} IS NOT NULL
            """);
    }

    private static async Task<RuleMatches> MatchAsync(PoliValkoDbContext db, IReadOnlyList<Category> categories, CancellationToken ct)
    {
        var byParent = categories.ToLookup(c => c.ParentId);
        var rows = Rules.SelectMany((rule, index) => categories
            .Where(c => rule.Sections.Any(section => Named(c, section)))
            .SelectMany(c => CategoryQueries.Descendants(c.Id, byParent).Prepend(c.Id)).Distinct()
            .Select(category => (Category: category, Rule: index, rule.Include, rule.Exclude))).ToArray();
        // One bit of a 64-bit number for each rule.
        if (Rules.Length > 63) throw new InvalidOperationException("The seasonal rule table has outgrown its matches.");
        var categoryIds = rows.Select(r => r.Category).ToArray();
        var rules = rows.Select(r => r.Rule).ToArray();
        var include = rows.Select(r => r.Include).ToArray();
        var exclude = rows.Select(r => r.Exclude).ToArray();
        var found = await db.Database.SqlQuery<Found>($"""
            WITH rules AS (
                SELECT * FROM unnest({categoryIds}::uuid[], {rules}::int[], {include}::text[], {exclude}::text[])
                    AS r(category_id, rule, wanted, unwanted)
            ), attributes AS (
                SELECT a.product_id, array_agg(a.value) AS terms FROM catalog.product_attributes a
                WHERE lower(a.name) = ANY({Attributes}) GROUP BY a.product_id
            )
            SELECT p.id AS product_id, bit_or(1::bigint << r.rule) AS rules
            FROM rules r JOIN catalog.products p ON p.category_id=r.category_id
            LEFT JOIN attributes a ON a.product_id=p.id
            WHERE p.is_visible AND NOT p.is_archived
              AND (coalesce(p.display_name,p.name) ~* r.wanted
                   OR EXISTS (SELECT FROM unnest(a.terms) term WHERE term ~* r.wanted))
              AND (r.unwanted IS NULL OR (coalesce(p.display_name,p.name) !~* r.unwanted
                   AND NOT EXISTS (SELECT FROM unnest(a.terms) term WHERE term ~* r.unwanted)))
            GROUP BY p.id
            """).ToArrayAsync(ct);
        return new RuleMatches(found.Select(row => row.ProductId).ToArray(), found.Select(row => row.Rules).ToArray());
    }
}

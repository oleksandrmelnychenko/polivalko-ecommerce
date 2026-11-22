using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Domain;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Catalog.Features.Storefront;

internal static class SeasonalPurpose
{
    internal sealed record Match(Guid ProductId, int? Family);
    private sealed record Rule(string Family, int From, int Through, string[] Sections, string Include, string? Exclude = null)
    {
        public bool Applies(int month) => From <= Through ? month >= From && month <= Through : month >= From || month <= Through;
    }

    private const string Covers = "Укривні матеріали";
    private const string Pruning = "Гілкорізи/Сучкорізи/Секатори/Ножиці";
    private const string WinterCare = "Прибирання снігу й льоду";
    private static readonly string[] Attributes = ["тип", "тип товару", "призначення", "тематика", "культура", "сезон", "сезонність", "період застосування", "сезон застосування"];

    // Inclusive months describe storefront priorities. Match only inside the named catalog branches.
    private static readonly Rule[] Rules =
    [
        new("novyi-rik", 11, 12, ["novyi-rik"], "новоріч|новий рік|різдв|ялин|гірлянд|мішур|санта|дід мороз|сніговик|верхівк|віно(к|ч)|бородань"),
        new("Обігрівачі", 10, 3, ["Обігрівачі"], "обігрів|обігрівач|нагрівач|конвектор|тепловентилятор"),
        new("Годівниці", 10, 3, ["Годівниці"], "годівниц|годівл.*птах|годуван.*птах"),
        new("Годівниці", 2, 4, ["Годівниці"], "шпаківн|синичник|гніздівл|будиночок для птах"),
        new(Covers, 9, 4, [Covers], "чох.*(рослин|троянд)|агроволокн.*біл|біл.*агроволокн|від (за)?мороз", "чорн.*біл|біл.*чорн"),
        new(Covers, 5, 8, [Covers], "^(сіт.*затін|затін.*сіт)", "кліпс|затискач"),
        new(WinterCare, 11, 2, ["Ручний інструмент", "Все для прибирання", "Автотовари"],
            "для снігу|снігоприб|снігов(а|і|ий) (лопат|скрепер)|антилід|ожелед|зимов.*омивач|омивач.*зимов|скребок.*льод"),
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
    ];

    public static (IQueryable<Match> Rows, int Families) Query(PoliValkoDbContext db, IReadOnlyList<Category> categories,
        DateOnly day, bool enabled)
    {
        if (!enabled) return (db.Database.SqlQuery<Match>($"SELECT NULL::uuid AS product_id, 0 AS family WHERE false"), 0);
        var byParent = categories.ToLookup(c => c.ParentId);
        string[] leadingTasks = day.Month switch
        {
            1 => ["Обігрівачі", WinterCare, "Годівниці", "Насіння", "Грунти та добавки"],
            4 => ["Насіння", "Посадка", "Горщики", "Грунти та добавки", "vse-dlia-polyvu"],
            8 => ["Збирання врожаю", "vse-dlia-polyvu", Covers, "Насіння"],
            9 => ["Збирання врожаю", "Насіння газонних трав", "Добрива", "Насіння", "Септик/Компост"],
            10 => [Covers, "Все для прибирання", "Консервація поливу", "Збирання врожаю", "Догляд за деревами"],
            _ => SeasonalMerchandising.PriorityCategories(day),
        };
        var priority = leadingTasks.Select((key, i) => (key, i)).ToDictionary(x => x.key, x => x.i);
        var active = Rules.Where(r => r.Applies(day.Month))
            .OrderBy(r => priority.GetValueOrDefault(r.Family, priority.Count));
        var groups = new List<string>();
        var rows = new List<(Guid Category, int Family, string Include, string? Exclude)>();
        foreach (var rule in active)
        {
            var ids = categories.Where(c => rule.Sections.Contains(c.Name) || rule.Sections.Contains(c.Slug))
                .SelectMany(c => CategoryQueries.Descendants(c.Id, byParent).Prepend(c.Id)).Distinct().ToArray();
            if (ids.Length == 0) continue;
            if (!groups.Contains(rule.Family)) groups.Add(rule.Family);
            rows.AddRange(ids.Select(id => (id, groups.IndexOf(rule.Family), rule.Include, rule.Exclude)));
        }
        var categoryIds = rows.Select(r => r.Category).ToArray();
        var families = rows.Select(r => r.Family).ToArray();
        var include = rows.Select(r => r.Include).ToArray();
        var exclude = rows.Select(r => r.Exclude).ToArray();
        var matches = db.Database.SqlQuery<Match>($"""
            WITH rules AS (
                SELECT * FROM unnest({categoryIds}::uuid[], {families}::int[], {include}::text[], {exclude}::text[])
                    AS r(category_id, family, wanted, unwanted)
            ), attributes AS (
                SELECT a.product_id, array_agg(a.value) AS terms FROM catalog.product_attributes a
                WHERE lower(a.name) = ANY({Attributes}) GROUP BY a.product_id
            )
            SELECT p.id AS product_id, min(r.family) AS family
            FROM rules r JOIN catalog.products p ON p.category_id=r.category_id
            LEFT JOIN attributes a ON a.product_id=p.id
            WHERE p.is_visible AND NOT p.is_archived
              AND (coalesce(p.display_name,p.name) ~* r.wanted
                   OR EXISTS (SELECT FROM unnest(a.terms) term WHERE term ~* r.wanted))
              AND (r.unwanted IS NULL OR (coalesce(p.display_name,p.name) !~* r.unwanted
                   AND NOT EXISTS (SELECT FROM unnest(a.terms) term WHERE term ~* r.unwanted)))
            GROUP BY p.id
            """);
        return (matches, groups.Count);
    }
}

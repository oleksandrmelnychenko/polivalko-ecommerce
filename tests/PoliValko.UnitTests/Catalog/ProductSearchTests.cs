using PoliValko.Catalog.Domain;
using PoliValko.Catalog.Features.Storefront;

namespace PoliValko.UnitTests;

public sealed class ProductSearchTests
{
    private static readonly Category Seeds = new() { Id = Guid.NewGuid(), Slug = "nasinnia", Name = "Насіння" };
    private static readonly Category LawnSeeds = new() { Id = Guid.NewGuid(), ParentId = Seeds.Id, Slug = "nasinnia-hazonnykh-trav", Name = "Насіння газонних трав" };
    private static readonly Category Fertilizers = new() { Id = Guid.NewGuid(), Slug = "dobryva", Name = "Добрива" };
    private static readonly Category Tools = new() { Id = Guid.NewGuid(), Slug = "instrument", Name = "Ручний інструмент" };
    private static readonly Category[] Categories = [Seeds, LawnSeeds, Fertilizers, Tools];

    private static readonly SearchEntry Tomato = Entry("Томат Бичаче серце Seedera", Seeds, brand: "Seedera");
    private static readonly SearchEntry LawnMix = Entry("Трава Спорт, 1 кг", LawnSeeds);
    private static readonly SearchEntry LawnFertilizer = Entry("Добриво осіннє для газону, 1 кг", Fertilizers);
    private static readonly SearchEntry Rake = Entry("Граблі для газону віялові", Tools, sku: "GR-600");
    private static readonly SearchEntry Pruner = Entry("Секатор площинний Fiskars", Tools, brand: "Fiskars", slug: "sekator-ploshchynnyi-fiskars");
    private static readonly SearchEntry Mower = Entry("Газонокосарка Viking", Tools, brand: "Viking", slug: "hazonokosarka-viking");
    private static readonly SearchEntry[] Catalog = [Tomato, LawnMix, LawnFertilizer, Rake, Pruner, Mower];

    [Fact]
    public void Section_name_counts_as_a_word_of_the_product() =>
        Find("насіння томату").Ids.ShouldBe([Tomato.Id]);

    [Fact]
    public void Section_matches_rank_below_name_matches()
    {
        var found = Find("газон");

        found.Ids.ShouldBe([LawnMix.Id, LawnFertilizer.Id, Rake.Id, Mower.Id], ignoreOrder: true);
        Position(found, LawnMix.Id).ShouldBeGreaterThan(Position(found, LawnFertilizer.Id));
        Position(found, Mower.Id).ShouldBe(1); // «газонокосарка» is a longer word: after «газону», before the section
        found.Approximate.ShouldBeFalse();
    }

    [Theory]
    [InlineData("удобрение для газона")]
    [InlineData("добрива газон")]
    [InlineData("ДОБРИВО на ГАЗОН")]
    public void Russian_and_other_forms_find_the_same_product(string q) =>
        Find(q).Ids.ShouldBe([LawnFertilizer.Id]);

    [Theory]
    [InlineData("насіння огірків", "Огірок Конкурент Seedera")]
    [InlineData("гирлянда на елку", "Гірлянда для ялинки 100 LED")]
    [InlineData("семена огурцов", "Огірок Конкурент Seedera")]
    public void Changing_vowels_and_short_russian_words_are_understood(string q, string name)
    {
        var product = Entry(name, Seeds);

        ProductSearch.Rank(q, [.. Catalog, product], Categories).Ids.ShouldBe([product.Id]);
    }

    [Fact]
    public void A_product_is_about_the_word_only_before_dlia()
    {
        var hose = Entry("Поливальний шланг Plus 1/2", Tools);
        var adapter = Entry("Перехідник Cellfast для шлангів 3/4", Tools);

        var found = ProductSearch.Rank("шланг", [hose, adapter], Categories);

        found.Ids.ShouldBe([hose.Id, adapter.Id], ignoreOrder: true);
        found.About.ShouldBe([hose.Id]);
    }

    [Fact]
    public void Grabli_in_russian_find_the_rake() =>
        Find("грабли").Ids.ShouldBe([Rake.Id]);

    [Fact]
    public void Wrong_keyboard_layout_is_read_as_ukrainian()
    {
        var found = Find("uhf,ks"); // «граблі»

        found.Ids.ShouldBe([Rake.Id]);
        found.Approximate.ShouldBeFalse();
    }

    [Theory]
    [InlineData("ашілфкі")] // «fiskars» on the Ukrainian layout
    [InlineData("ашылфкы")] // and on the Russian one
    public void Latin_brand_typed_on_a_cyrillic_layout_is_found(string q) =>
        Find(q).Ids.ShouldBe([Pruner.Id]);

    [Fact]
    public void Typo_is_matched_to_a_similar_catalog_word()
    {
        var found = Find("секатр");

        found.Ids.ShouldBe([Pruner.Id]);
        found.Approximate.ShouldBeTrue();
    }

    [Fact]
    public void Latin_brand_typed_in_cyrillic_is_matched_to_the_brand() =>
        Find("вікінг").Ids.ShouldBe([Mower.Id]);

    [Fact]
    public void An_unknown_extra_word_is_dropped_instead_of_emptying_the_result()
    {
        var found = Find("граблі дешевізна");

        found.Ids.ShouldBe([Rake.Id]);
        found.Approximate.ShouldBeTrue();
    }

    [Fact]
    public void Words_that_never_meet_rank_products_by_how_many_they_have()
    {
        var found = Find("граблі томат");

        found.Ids.ShouldBe([Rake.Id, Tomato.Id], ignoreOrder: true);
        found.Approximate.ShouldBeTrue();
    }

    [Fact]
    public void Sku_is_found_whole_and_by_its_start()
    {
        var whole = Find("gr-600");
        whole.Ids.ShouldBe([Rake.Id]);
        whole.Better.ShouldBeEmpty();
        Find("GR-6").Ids.ShouldBe([Rake.Id]);
    }

    [Theory]
    [InlineData("жжжффф")]
    [InlineData("для")]
    [InlineData("'")]
    public void Nonsense_stop_words_and_punctuation_find_nothing(string q)
    {
        var found = Find(q);

        found.Ids.ShouldBeEmpty();
        found.Approximate.ShouldBeFalse();
    }

    [Fact]
    public void Synonym_inside_another_word_does_not_match()
    {
        var frost = Entry("Агроволокно від мороза", Tools);

        ProductSearch.Rank("троянда", [frost], Categories).Ids.ShouldBeEmpty();
    }

    [Theory]
    [InlineData("секатор", "секатр", 1)]
    [InlineData("грабли", "грабил", 1)]
    [InlineData("газон", "газон", 0)]
    [InlineData("кіт", "собака", 6)]
    public void Distance_counts_edits_and_swaps(string a, string b, int edits) =>
        ProductSearch.Distance(a, b).ShouldBe(edits);

    private static SearchRanking Find(string q) => ProductSearch.Rank(q, Catalog, Categories);

    /// <summary>0 for the best group; higher is worse.</summary>
    private static int Position(SearchRanking ranking, Guid id)
    {
        for (var i = 0; i < ranking.Better.Count; i++)
        {
            if (ranking.Better[i].Contains(id)) return i;
        }

        return ranking.Better.Count;
    }

    private static SearchEntry Entry(string name, Category category, string? brand = null, string? sku = null, string? slug = null)
    {
        var id = Guid.NewGuid();
        return new SearchEntry(id, name, null, brand, slug ?? $"p-{id:N}", sku ?? $"SKU-{id.ToString("N")[..6]}", category.Id);
    }
}

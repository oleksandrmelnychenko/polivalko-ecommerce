using PoliValko.Catalog.Features.Storefront;

namespace PoliValko.UnitTests;

public sealed class ProductSearchTextTests
{
    [Theory]
    [InlineData("шланги", "шланг")]
    [InlineData("шлангу", "шланг")]
    [InlineData("шлангами", "шланг")]
    [InlineData("лопати", "лопат")]
    [InlineData("лопатою", "лопат")]
    [InlineData("садові", "садов")]
    [InlineData("поливальний", "поливальн")]
    [InlineData("газонокосарки", "газонокосарк")]
    [InlineData("дерев'яна", "дерев'ян")]
    public void Stem_drops_ukrainian_endings(string word, string stem) =>
        ProductSearchText.Stem(word).ShouldBe(stem);

    [Theory]
    [InlineData("шланг")]
    [InlineData("вила")]
    [InlineData("сад")]
    [InlineData("viking")]
    [InlineData("1/2")]
    [InlineData("demo-001")]
    public void Stem_keeps_short_latin_and_numeric_words(string word) =>
        ProductSearchText.Stem(word).ShouldBe(word);

    [Fact]
    public void Words_are_lowercased_trimmed_deduplicated_and_skip_single_letters() =>
        ProductSearchText.Words("  Шланг, 1/2\" 20 м шланг ").ShouldBe(["шланг", "1/2", "20"]);

    [Fact]
    public void Single_letter_query_is_kept_as_is() =>
        ProductSearchText.Words("М").ShouldBe(["м"]);
}

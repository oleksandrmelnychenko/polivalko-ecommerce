using PoliValko.Catalog.Features.Storefront;

namespace PoliValko.UnitTests;

public sealed class SeoDescriptionSnippetTests
{
    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("<p><br></p>")]
    [InlineData("<p>Легка мінеральна добавка до субстратів. Фасування 3 л.</p>")]
    public void Short_or_empty_descriptions_leave_the_template_in_charge(string? html) =>
        SeoTemplates.DescriptionSnippet(html).ShouldBeNull();

    [Fact]
    public void Tags_and_entities_become_plain_text_and_a_fitting_text_is_kept_whole()
    {
        const string html = "<p>Металевий імпульсний зрошувач Cellfast&nbsp;LUX на кілку з упорами.</p><ul><li>Площа поливу: до 530 м²</li><li>Різьба: G3/4″</li></ul><p>Сектор від 20° до 360°.</p>";

        var snippet = SeoTemplates.DescriptionSnippet(html);

        snippet.ShouldBe("Металевий імпульсний зрошувач Cellfast LUX на кілку з упорами. Площа поливу: до 530 м² Різьба: G3/4″ Сектор від 20° до 360°.");
    }

    [Fact]
    public void A_long_text_is_cut_at_the_last_sentence_within_the_limit()
    {
        var first = new string('а', 70) + ". ";
        var second = new string('б', 60) + ". ";
        var third = new string('в', 80) + ".";

        var snippet = SeoTemplates.DescriptionSnippet($"<p>{first}{second}{third}</p>");

        snippet.ShouldBe((first + second).TrimEnd());
        snippet!.Length.ShouldBeLessThanOrEqualTo(SeoTemplates.SnippetMaxLength);
    }

    [Fact]
    public void Without_a_sentence_end_the_text_is_cut_at_a_word_with_an_ellipsis()
    {
        var words = string.Join(' ', Enumerable.Repeat("слово", 40));

        var snippet = SeoTemplates.DescriptionSnippet($"<p>{words}</p>");

        snippet.ShouldNotBeNull();
        snippet.ShouldEndWith("слово…");
        snippet.Length.ShouldBeLessThanOrEqualTo(SeoTemplates.SnippetMaxLength);
    }

    [Fact]
    public void Templated_descriptions_over_158_chars_are_clipped_cleanly_while_shorter_ones_stay_verbatim()
    {
        const string shortDesc = "Дощувач у магазині Poli Valko: доставка Новою поштою по Україні або самовивіз з магазину.";
        SeoTemplates.GuardDescriptionLength(shortDesc).ShouldBe(shortDesc);

        const string longDesc =
            "Квіти Петунія великоквіткова низькоросла Пікоті Бургунд F1 SeedEra 10 шт у магазині Poli Valko: ціна 39 грн, доставка Новою поштою по Україні або самовивіз з магазину.";
        var clipped = SeoTemplates.GuardDescriptionLength(longDesc);

        clipped.Length.ShouldBeLessThanOrEqualTo(SeoTemplates.SnippetMaxLength);
        clipped.Length.ShouldBeGreaterThanOrEqualTo(SeoTemplates.SnippetMinLength);
        clipped.ShouldEndWith("…");
    }
}

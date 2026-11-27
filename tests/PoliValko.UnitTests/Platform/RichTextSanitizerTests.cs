using Microsoft.Extensions.Options;
using PoliValko.Infrastructure.Storefront;
using PoliValko.Infrastructure.Text;

namespace PoliValko.UnitTests;

public sealed class RichTextSanitizerTests
{
    private static RichTextSanitizer Create(string publicUrl = "https://www.poli-valko.com") =>
        new(Options.Create(new SiteOptions { PublicUrl = publicUrl }));

    [Theory]
    [InlineData("/catalog/vse-dlia-polyvu")]
    [InlineData("/services/montazh-avtopolyvu")]
    [InlineData("#faq")]
    [InlineData("?page=2")]
    [InlineData("https://www.poli-valko.com/catalog/hunter")]
    [InlineData("https://poli-valko.com/brands/bros")]
    [InlineData("HTTPS://WWW.POLI-VALKO.COM/blog")]
    [InlineData("mailto:shop@poli-valko.com")]
    [InlineData("tel:+380738185222")]
    public void Internal_links_never_carry_nofollow_even_when_the_editor_sent_it(string href)
    {
        var html = Create().Sanitize($"<p><a href=\"{href}\" rel=\"noopener noreferrer nofollow\">Посилання</a></p>");

        html.ShouldNotBeNull();
        html.ShouldNotContain("rel=");
        html.ShouldNotContain("nofollow");
        html.ShouldContain("Посилання</a>");
    }

    [Theory]
    [InlineData("https://example.com/manufacturer")]
    [InlineData("http://hunterirrigation.com/")]
    [InlineData("//evil.example/path")]
    [InlineData("https://poli-valko.com.evil.example/")]
    [InlineData("https://notpoli-valko.com/")]
    public void External_links_are_nofollow_noopener(string href)
    {
        var html = Create().Sanitize($"<p><a href=\"{href}\">Джерело</a></p>");

        html.ShouldNotBeNull();
        html.ShouldContain($"rel=\"{RichTextSanitizer.ExternalLinkRel}\"");
    }

    [Fact]
    public void Configured_public_host_counts_as_internal()
    {
        var sanitizer = Create("https://staging.shop.example.ua");

        sanitizer.IsExternal("https://staging.shop.example.ua/catalog/x").ShouldBeFalse();
        sanitizer.IsExternal("https://www.poli-valko.com/catalog/x").ShouldBeFalse();
        sanitizer.IsExternal("https://shop.example.ua/catalog/x").ShouldBeTrue();
    }

    [Fact]
    public void Mixed_content_keeps_rel_only_on_external_links_and_still_strips_xss()
    {
        var html = Create().Sanitize(
            "<p>Див. <a href=\"/catalog/krapelnyi-polyv\" rel=\"nofollow\" onclick=\"alert(1)\">крапельний полив</a> і " +
            "<a href=\"https://irritec.com\" rel=\"noopener noreferrer nofollow\">Irritec</a></p>");

        html.ShouldBe(
            "<p>Див. <a href=\"/catalog/krapelnyi-polyv\">крапельний полив</a> і " +
            $"<a href=\"https://irritec.com\" rel=\"{RichTextSanitizer.ExternalLinkRel}\">Irritec</a></p>");

        var withScript = Create().Sanitize("<p><a href=\"/services/hazony\" rel=\"nofollow\">Газони</a><script>alert(1)</script></p>");
        withScript.ShouldNotBeNull();
        withScript.ShouldContain("<a href=\"/services/hazony\">Газони</a>");
        withScript.ShouldNotContain("<script");
    }
}

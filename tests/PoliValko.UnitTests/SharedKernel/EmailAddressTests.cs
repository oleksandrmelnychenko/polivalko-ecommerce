using PoliValko.SharedKernel;

namespace PoliValko.UnitTests;

public sealed class EmailAddressTests
{
    [Theory]
    [InlineData("name@example.com")]
    [InlineData("a@b.c")]
    [InlineData("іван@приклад.укр")]
    [InlineData("first.last+tag@sub.example.ua")]
    public void Plain_addresses_are_accepted(string value) =>
        EmailAddress.IsValid(value).ShouldBeTrue();

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("Іван Петренко <ivan@example.com>")]
    [InlineData("\"Ivan\" <ivan@example.com>")]
    [InlineData("<ivan@example.com>")]
    [InlineData("ivan petrenko@example.com")]
    [InlineData("ivan@example.com, other@example.com")]
    [InlineData("ivan@example.com (comment)")]
    [InlineData("ivan@example.com\r\nBcc: x@y.z")]
    [InlineData("ivan@example")]
    [InlineData("ivan@localhost")]
    [InlineData("ivan@[127.0.0.1]")]
    [InlineData("ivan@@example.com")]
    [InlineData("@example.com")]
    [InlineData("ivan@")]
    [InlineData(" ivan@example.com")]
    public void Display_names_lists_and_hosts_without_a_domain_are_rejected(string? value) =>
        EmailAddress.IsValid(value).ShouldBeFalse();

    [Fact]
    public void Addresses_longer_than_the_column_are_rejected() =>
        EmailAddress.IsValid(new string('a', 190) + "@example.com").ShouldBeFalse();
}

public sealed class PageRequestTests
{
    [Fact]
    public void Huge_page_numbers_are_clamped_so_the_offset_cannot_overflow()
    {
        var request = PageRequest.From(int.MaxValue, 100);

        request.Page.ShouldBe(PageRequest.MaxPage);
        request.Skip.ShouldBeGreaterThan(0);
    }
}

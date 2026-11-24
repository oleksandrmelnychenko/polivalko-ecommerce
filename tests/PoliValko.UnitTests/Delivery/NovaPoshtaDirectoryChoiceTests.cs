using PoliValko.Delivery.Features.Directory;

namespace PoliValko.UnitTests.Delivery;

public sealed class NovaPoshtaDirectoryChoiceTests
{
    [Theory]
    [InlineData(true, "Production", NovaPoshtaDirectoryChoice.Api)]
    [InlineData(true, "Development", NovaPoshtaDirectoryChoice.Api)]
    [InlineData(false, "Development", NovaPoshtaDirectoryChoice.Demo)]
    [InlineData(false, "Testing", NovaPoshtaDirectoryChoice.Demo)]
    // A live shop that lost its key must not offer ten made-up cities and take orders to branches that do not exist.
    [InlineData(false, "Production", NovaPoshtaDirectoryChoice.Unavailable)]
    [InlineData(false, "Staging", NovaPoshtaDirectoryChoice.Demo)]
    public void The_demo_directory_is_never_used_by_the_live_shop(bool configured, string environment, NovaPoshtaDirectoryChoice expected) =>
        NovaPoshtaDirectoryChoices.For(configured, environment).ShouldBe(expected);
}

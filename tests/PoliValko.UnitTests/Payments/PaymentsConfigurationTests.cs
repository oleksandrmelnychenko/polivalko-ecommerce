using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using PoliValko.Payments;
using PoliValko.Payments.Configuration;

namespace PoliValko.UnitTests.Payments;

public sealed class PaymentsConfigurationTests
{
    [Theory]
    [InlineData(null, null, null)]
    [InlineData("Disabled", null, null)]
    [InlineData("Sandbox", "true", null)]
    [InlineData("Mono", null, "merchant-token")]
    public void Valid_payment_settings_start(string? provider, string? allowSandbox, string? monoToken) =>
        Options(provider, allowSandbox, monoToken).Provider.ShouldBe(provider);

    [Theory]
    [InlineData("Sandbox", null, null, "AllowSandbox")]
    [InlineData("sandbox", "false", null, "AllowSandbox")]
    [InlineData("Mono", null, null, "Mono:Token")]
    [InlineData("Mnoo", null, null, "допустимі значення")]
    public void Unsafe_or_broken_payment_settings_stop_the_host(string provider, string? allowSandbox, string? monoToken, string reason) =>
        Should.Throw<OptionsValidationException>(() => Options(provider, allowSandbox, monoToken)).Message.ShouldContain(reason);

    private static PaymentsOptions Options(string? provider, string? allowSandbox, string? monoToken)
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Payments:Provider"] = provider,
                ["Payments:AllowSandbox"] = allowSandbox,
                ["Payments:Mono:Token"] = monoToken,
            })
            .Build();
        using var services = new ServiceCollection().AddPaymentsModule(configuration).BuildServiceProvider();
        return services.GetRequiredService<IOptions<PaymentsOptions>>().Value;
    }
}

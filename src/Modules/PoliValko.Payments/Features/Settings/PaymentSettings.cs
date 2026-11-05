using Microsoft.Extensions.Options;
using PoliValko.Payments.Configuration;
using PoliValko.Payments.Contracts;
using PoliValko.Payments.Integrations.Providers;

namespace PoliValko.Payments.Features.Settings;

internal sealed class PaymentSettings(IOptions<PaymentsOptions> options) : IPaymentSettings
{
    public string Provider => options.Value.Provider?.Trim().ToLowerInvariant() switch
    {
        PaymentProviderNames.Sandbox => "Sandbox",
        PaymentProviderNames.Mono => "Mono",
        _ => "None",
    };

    public string Mode => Provider switch
    {
        "Sandbox" => "Test",
        "Mono" => "Live",
        _ => "Disabled",
    };
}

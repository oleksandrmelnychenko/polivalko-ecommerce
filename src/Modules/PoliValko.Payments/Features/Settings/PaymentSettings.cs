using PoliValko.Payments.Contracts;
using PoliValko.Payments.Integrations.Providers;

namespace PoliValko.Payments.Features.Settings;

internal sealed class PaymentSettings(PaymentGateways gateways) : IPaymentSettings
{
    public async Task<PaymentSettingsSummary> GetAsync(CancellationToken ct)
    {
        var providers = (await gateways.OptionsAsync(ct)).Select(o => o.Provider).Distinct().ToList();
        if (providers.Count == 0)
        {
            return new("None", "Disabled");
        }

        // LiqPay keys starting with sandbox_ take test payments only.
        var testLiqPay = (await gateways.LoadAsync(ct)).LiqPayPublicKey?.StartsWith("sandbox_", StringComparison.Ordinal) == true;
        var live = providers.Any(p => p != PaymentProviderNames.Sandbox && !(p == PaymentProviderNames.LiqPay && testLiqPay));
        return new(string.Join(',', providers), live ? "Live" : "Test");
    }
}

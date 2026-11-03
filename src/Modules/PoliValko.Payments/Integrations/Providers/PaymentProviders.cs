using PoliValko.Payments.Configuration;

namespace PoliValko.Payments.Integrations.Providers;

internal sealed class PaymentProviders(IEnumerable<IPaymentProvider> providers, Microsoft.Extensions.Options.IOptions<PaymentsOptions> options) : IPaymentProviders
{
    public IPaymentProvider? Active => Find(options.Value.Provider ?? string.Empty);

    public IPaymentProvider? Find(string name) =>
        providers.FirstOrDefault(p => string.Equals(p.Name, name, StringComparison.OrdinalIgnoreCase));
}

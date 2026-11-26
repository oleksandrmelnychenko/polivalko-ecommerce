namespace PoliValko.Payments.Integrations.Providers;

internal sealed class PaymentProviders(IEnumerable<IPaymentProvider> providers) : IPaymentProviders
{
    public IPaymentProvider? Find(string name) =>
        providers.FirstOrDefault(p => string.Equals(p.Name, name, StringComparison.OrdinalIgnoreCase));
}

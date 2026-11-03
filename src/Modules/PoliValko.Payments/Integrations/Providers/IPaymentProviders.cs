namespace PoliValko.Payments.Integrations.Providers;

public interface IPaymentProviders
{
    IPaymentProvider? Active { get; }

    IPaymentProvider? Find(string name);
}

namespace PoliValko.Payments.Integrations.Providers;

public interface IPaymentProviders
{
    /// <summary>
    /// The provider by name, whether or not the buyer can pick it now: payments opened before a bank was switched
    /// off still need their webhooks, reconciliation and refunds.
    /// </summary>
    IPaymentProvider? Find(string name);
}

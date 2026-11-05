namespace PoliValko.Payments.Contracts;

public interface IPaymentSettings
{
    string Provider { get; }

    string Mode { get; }
}

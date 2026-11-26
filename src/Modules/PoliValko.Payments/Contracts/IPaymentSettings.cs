namespace PoliValko.Payments.Contracts;

public interface IPaymentSettings
{
    Task<PaymentSettingsSummary> GetAsync(CancellationToken ct);
}

/// <param name="Provider">The banks the buyer can choose, comma-separated codes (<c>mono,liqpay</c>), or <c>None</c>.</param>
/// <param name="Mode"><c>Live</c>, <c>Test</c> or <c>Disabled</c>.</param>
public sealed record PaymentSettingsSummary(string Provider, string Mode);

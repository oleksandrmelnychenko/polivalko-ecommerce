namespace PoliValko.Fiscal.Contracts;

public interface IFiscalSettings
{
    Task<FiscalSettingsSummary> GetAsync(CancellationToken ct);
}

/// <param name="Provider"><c>Checkbox</c>, <c>Stub</c> or <c>Disabled</c>.</param>
/// <param name="Mode"><c>Live</c>, <c>Stub</c> or <c>Disabled</c>.</param>
/// <param name="Card">When a card payment gets its receipt: <c>payment</c>, <c>completion</c> or <c>none</c>.</param>
public sealed record FiscalSettingsSummary(string Provider, string Mode, string Card, string CashOnDelivery, string Pickup);

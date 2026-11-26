using PoliValko.Fiscal.Contracts;
using PoliValko.Fiscal.Domain;
using PoliValko.Ordering.Contracts;

namespace PoliValko.Fiscal.Features.Settings;

internal sealed class FiscalSettings(FiscalGateway gateway) : IFiscalSettings
{
    public async Task<FiscalSettingsSummary> GetAsync(CancellationToken ct)
    {
        var value = await gateway.LoadAsync(ct);
        var mode = value.Provider switch
        {
            FiscalGateway.Checkbox => "Live",
            FiscalGateway.Stub => "Stub",
            _ => "Disabled",
        };
        return new(value.Provider, mode, Moment(PaymentMethod.Card), Moment(PaymentMethod.CashOnDelivery), Moment(PaymentMethod.PayOnPickup));

        string Moment(PaymentMethod method) =>
            value.Provider == FiscalGateway.Disabled ? "none" : MomentCode(value.IssueOn.GetValueOrDefault(method, ReceiptMoment.None));
    }

    internal static string MomentCode(ReceiptMoment moment) => moment switch
    {
        ReceiptMoment.Payment => "payment",
        ReceiptMoment.Completion => "completion",
        _ => "none",
    };
}

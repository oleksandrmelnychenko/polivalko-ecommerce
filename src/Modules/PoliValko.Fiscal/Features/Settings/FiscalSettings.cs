using Microsoft.Extensions.Options;
using PoliValko.Fiscal.Configuration;
using PoliValko.Fiscal.Contracts;
using PoliValko.Fiscal.Domain;
using PoliValko.Ordering.Contracts;

namespace PoliValko.Fiscal.Features.Settings;

internal sealed class FiscalSettings(IOptions<FiscalOptions> options) : IFiscalSettings
{
    public string Provider => options.Value.Provider?.Trim().ToLowerInvariant() switch
    {
        "checkbox" => "Checkbox",
        "stub" => "Stub",
        _ => "Disabled",
    };

    public string Mode => Provider switch
    {
        "Checkbox" => "Live",
        "Stub" => "Stub",
        _ => "Disabled",
    };

    public string IssueOn(PaymentMethod method) =>
        Provider == "Disabled"
            ? "none"
            : options.Value.IssueOn.GetValueOrDefault(method, ReceiptMoment.None) switch
            {
                ReceiptMoment.Payment => "payment",
                ReceiptMoment.Completion => "completion",
                _ => "none",
            };
}

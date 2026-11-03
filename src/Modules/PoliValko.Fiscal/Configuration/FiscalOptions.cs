using PoliValko.Fiscal.Domain;
using PoliValko.Ordering.Contracts;

namespace PoliValko.Fiscal.Configuration;

public sealed class FiscalOptions
{
    public string Provider { get; set; } = "Disabled";

    public Dictionary<PaymentMethod, ReceiptMoment> IssueOn { get; set; } = new()
    {
        [PaymentMethod.Card] = ReceiptMoment.Payment,
        [PaymentMethod.CashOnDelivery] = ReceiptMoment.Completion,
        [PaymentMethod.PayOnPickup] = ReceiptMoment.None,
    };

    public Dictionary<PaymentMethod, string> PaymentTypes { get; set; } = new()
    {
        [PaymentMethod.Card] = "CASHLESS",
        [PaymentMethod.CashOnDelivery] = "CASHLESS",
        [PaymentMethod.PayOnPickup] = "CASH",
    };

    public CheckboxOptions Checkbox { get; set; } = new();
}

using PoliValko.Ordering.Contracts;
using PoliValko.Payments.Contracts;

namespace PoliValko.Payments.Features.Settings;

internal sealed class CardPayments(IPaymentSettings settings) : ICardPayments
{
    public bool Available => settings.Mode != "Disabled";
}

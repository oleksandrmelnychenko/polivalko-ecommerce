using PoliValko.Ordering.Contracts;

namespace PoliValko.Payments.Features.Settings;

internal sealed class CardPayments(PaymentGateways gateways) : ICardPayments
{
    public async Task<IReadOnlyList<CardPaymentOption>> GetOptionsAsync(CancellationToken ct) =>
        (await gateways.OptionsAsync(ct)).Select(o => new CardPaymentOption(o.Code, o.Name, o.Hint)).ToList();
}

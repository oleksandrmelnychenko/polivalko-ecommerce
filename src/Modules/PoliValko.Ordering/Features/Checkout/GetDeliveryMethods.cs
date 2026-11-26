using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using PoliValko.Delivery.Contracts;
using PoliValko.Ordering.Contracts;

namespace PoliValko.Ordering.Features.Checkout;

internal static class GetDeliveryMethods
{
    public static async Task<Ok<IReadOnlyList<DeliveryMethodOptionDto>>> HandleAsync(
        IDeliveryAvailability delivery, ICardPayments cards, CancellationToken ct) =>
        TypedResults.Ok(CheckoutCalculator.DeliveryOptions(await cards.GetOptionsAsync(ct), await delivery.GetAsync(ct)));
}

using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using PoliValko.Delivery.Contracts;

namespace PoliValko.Ordering.Features.Checkout;

internal static class GetDeliveryMethods
{
    public static async Task<Ok<IReadOnlyList<DeliveryMethodOptionDto>>> HandleAsync(IDeliveryAvailability delivery, CancellationToken ct) =>
        TypedResults.Ok(CheckoutCalculator.DeliveryOptions(await delivery.GetAsync(ct)));
}

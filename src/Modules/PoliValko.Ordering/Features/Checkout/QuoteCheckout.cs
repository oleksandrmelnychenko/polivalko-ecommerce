using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using PoliValko.Catalog.Contracts;
using PoliValko.SharedKernel;

namespace PoliValko.Ordering.Features.Checkout;

internal static class QuoteCheckout
{
    public static async Task<Results<Ok<QuoteDto>, ValidationProblem>> HandleAsync(
        QuoteRequest request,
        CheckoutCalculator calculator,
        ICatalogFreshness freshness,
        CancellationToken ct)
    {
        var errors = new Dictionary<string, string[]>();
        CheckoutCalculator.ValidateItems(request.Items, errors);
        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var (lines, subtotal) = await calculator.PriceAsync(request.Items!, ct);
        return TypedResults.Ok(new QuoteDto(
            lines.Select(CheckoutCalculator.ToDto).ToList(),
            MoneyDto.Hryvnia(subtotal),
            MoneyDto.Hryvnia(subtotal),
            "Доставка оплачується за тарифами перевізника",
            CheckoutCalculator.DeliveryOptions,
            await freshness.IsFreshAsync(ct)));
    }
}

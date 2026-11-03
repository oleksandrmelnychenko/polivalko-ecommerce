using System.Globalization;
using System.Net;
using PoliValko.Ordering.Features.Checkout;

namespace PoliValko.IntegrationTests;

internal static class TestOrders
{
    public static async Task<OrderCreatedDto> PlaceAsync(ApiFactory api, Guid productId, int quantity, decimal unitPrice, string phone, CustomerRequest? customer = null)
    {
        var total = (unitPrice * quantity).ToString("0.00", CultureInfo.InvariantCulture);
        var body = CheckoutApiTests.Order(productId, quantity, total, phone);
        var response = await new CheckoutApiTests(api).PostOrderAsync(customer is null ? body : body with { Customer = customer }, Guid.NewGuid().ToString());
        return await response.ReadAsync<OrderCreatedDto>(HttpStatusCode.Created);
    }
}

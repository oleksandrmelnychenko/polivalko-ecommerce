using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using PoliValko.Ordering.Features.Admin.Customers;
using PoliValko.Ordering.Features.Checkout;
using PoliValko.SharedKernel;

namespace PoliValko.IntegrationTests;

public sealed class AdminCustomerApiTests(ApiFactory api)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Customers_are_aggregated_by_phone()
    {
        var phone = CheckoutApiTests.UniquePhone();
        var email = $"taras.{phone[^7..]}@example.com";
        var product = await api.AddProductAsync("vse-dlia-roslyn", "Горщик для покупців", 150m, stock: 10);
        await TestOrders.PlaceAsync(api, product.Id, 2, 150m, phone, new CustomerRequest("Тарас Покупець", phone, email));
        var last = await TestOrders.PlaceAsync(api, product.Id, 3, 150m, phone);
        var manager = await Staff.ManagerAsync(api);

        var page = await manager.ReadAsync<PagedResponse<AdminCustomerDto>>($"/api/v1/admin/customers?q={Uri.EscapeDataString(phone)}");

        var customer = page.Items.ShouldHaveSingleItem();
        customer.Phone.ShouldBe(phone);
        customer.Name.ShouldBe("Олена Тестова");
        customer.Email.ShouldBe(email);
        customer.Orders.ShouldBe(2);
        customer.TotalSpent.ShouldBe(MoneyDto.Hryvnia(750m));
        customer.LastOrderNumber.ShouldBe(last.Number);
        customer.FirstOrderAt.ShouldBeLessThanOrEqualTo(customer.LastOrderAt);

        foreach (var q in new[] { "тарас ПОКУПЕЦЬ", email.ToUpperInvariant() })
        {
            var found = await manager.ReadAsync<PagedResponse<AdminCustomerDto>>($"/api/v1/admin/customers?q={Uri.EscapeDataString(q)}");
            found.Items.ShouldHaveSingleItem().Orders.ShouldBe(2);
        }

        var bySpent = await manager.ReadAsync<PagedResponse<AdminCustomerDto>>("/api/v1/admin/customers?sort=totalSpent&pageSize=100");
        bySpent.Items.Select(c => Amount(c.TotalSpent)).ShouldBeInOrder(SortDirection.Descending);
        var byOrders = await manager.ReadAsync<PagedResponse<AdminCustomerDto>>("/api/v1/admin/customers?sort=orders&pageSize=100");
        byOrders.Items.Select(c => c.Orders).ShouldBeInOrder(SortDirection.Descending);

        var invalid = await manager.GetAsync("/api/v1/admin/customers?sort=name", Ct);
        invalid.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await invalid.Content.ReadFromJsonAsync<ProblemBody>(Ct))!.Errors!.ShouldContainKey("sort");
    }

    private static decimal Amount(MoneyDto money) => decimal.Parse(money.Value, CultureInfo.InvariantCulture);
}

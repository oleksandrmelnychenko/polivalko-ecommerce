using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using PoliValko.Customers.Features.Auth;
using PoliValko.Fiscal.Features.Receipts;
using PoliValko.Ordering.Contracts;
using PoliValko.Ordering.Domain;
using PoliValko.Ordering.Features.Account;
using PoliValko.Ordering.Features.Checkout;
using PoliValko.Payments.Features.Checkout;
using PoliValko.SharedKernel;

namespace PoliValko.IntegrationTests;

public sealed class AccountOrderApiTests(ApiFactory api)
{
    private const string Orders = "/api/v1/account/orders";

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Confirming_the_email_links_earlier_guest_orders_with_that_email_only()
    {
        var product = await api.AddProductAsync("ruchnyi-instrument", "Секатор для кабінету", 500m, stock: 50);
        var email = Accounts.UniqueEmail();
        var phone = CheckoutApiTests.UniquePhone();
        var before = await TestOrders.PlaceAsync(api, product.Id, 1, 500m, phone, new CustomerRequest("Олена Тестова", phone, email.ToUpperInvariant()));
        var otherPhone = CheckoutApiTests.UniquePhone();
        var foreign = await TestOrders.PlaceAsync(api, product.Id, 1, 500m, otherPhone, new CustomerRequest("Інна Тестова", otherPhone, Accounts.UniqueEmail()));
        var noEmail = await TestOrders.PlaceAsync(api, product.Id, 1, 500m, phone);

        var (client, me) = await Accounts.RegisterAsync(api, email);
        var pending = await TestOrders.PlaceAsync(api, product.Id, 2, 500m, phone, new CustomerRequest("Олена Тестова", phone, email));
        (await CustomerOfAsync(pending.Number)).ShouldBeNull("поки email не підтверджено, гостьове замовлення не прив'язується");
        (await client.ReadAsync<PagedResponse<AccountOrderListItemDto>>(Orders)).Items.ShouldBeEmpty();

        await Accounts.ConfirmEmailAsync(api, client, email);

        var linked = await client.ReadAsync<PagedResponse<AccountOrderListItemDto>>(Orders);
        linked.Items.Select(o => o.Number).ShouldBe([pending.Number, before.Number]);
        linked.TotalItems.ShouldBe(2);
        (await CustomerOfAsync(foreign.Number)).ShouldBeNull();
        (await CustomerOfAsync(noEmail.Number)).ShouldBeNull();
        (await client.GetAsync($"{Orders}/{foreign.Number}", Ct)).StatusCode.ShouldBe(HttpStatusCode.NotFound);

        var after = await TestOrders.PlaceAsync(api, product.Id, 1, 500m, phone, new CustomerRequest("Олена Тестова", phone, $" {email.ToUpperInvariant()} "));
        (await CustomerOfAsync(after.Number)).ShouldBe(me.Id);
        (await client.ReadAsync<PagedResponse<AccountOrderListItemDto>>($"{Orders}?page=1&pageSize=2")).ShouldSatisfyAllConditions(
            page => page.Items.Select(o => o.Number).ShouldBe([after.Number, pending.Number]),
            page => page.TotalItems.ShouldBe(3),
            page => page.TotalPages.ShouldBe(2));
    }

    [Fact]
    public async Task Order_placed_while_signed_in_is_visible_only_to_its_customer()
    {
        var cheap = await api.AddProductAsync("vse-dlia-polyvu", "Лійка для кабінету", 150m, stock: 10);
        var main = await api.AddProductAsync("vse-dlia-polyvu", "Шланг для кабінету", 900m, stock: 10);
        var (client, me) = await Accounts.RegisterAsync(api);
        var body = CheckoutApiTests.Order(cheap.Id, 2, "1200.00", CheckoutApiTests.UniquePhone()) with
        {
            Items = [new CartLineRequest(cheap.Id, 2), new CartLineRequest(main.Id, 1)],
        };
        var created = await (await new CheckoutApiTests(api).PostOrderAsync(body, Guid.NewGuid().ToString(), client))
            .ReadAsync<OrderCreatedDto>(HttpStatusCode.Created);
        (await CustomerOfAsync(created.Number)).ShouldBe(me.Id);

        var item = (await client.ReadAsync<PagedResponse<AccountOrderListItemDto>>(Orders)).Items.ShouldHaveSingleItem();
        item.Number.ShouldBe(created.Number);
        item.Status.ShouldBe(OrderStatus.New);
        item.PaymentMethod.ShouldBe(PaymentCodes.CashOnDelivery);
        item.PaymentStatus.ShouldBe(PaymentStatus.NotRequired);
        item.DeliveryMethod.ShouldBe(DeliveryCodes.NovaPoshta);
        item.Total.ShouldBe(new MoneyDto("1200.00", "UAH"));
        item.ItemCount.ShouldBe(2);
        item.MainItemName.ShouldBe("Шланг для кабінету");
        item.CanPay.ShouldBeFalse();

        var order = await client.ReadAsync<OrderDto>($"{Orders}/{created.Number}");
        order.Number.ShouldBe(created.Number);
        order.Items.Count.ShouldBe(2);
        order.Delivery.SettlementName.ShouldBe("Буча");
        (await client.ReadAsync<List<ReceiptDto>>($"{Orders}/{created.Number}/receipts")).ShouldBeEmpty();

        var (stranger, _) = await Accounts.RegisterAsync(api);
        var hidden = await stranger.GetAsync($"{Orders}/{created.Number}", Ct);
        hidden.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await hidden.ProblemCodeAsync()).ShouldBe("ordering.order_not_found");
        (await stranger.GetAsync($"{Orders}/{created.Number}/receipts", Ct)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await stranger.ReadAsync<PagedResponse<AccountOrderListItemDto>>(Orders)).Items.ShouldBeEmpty();
        (await stranger.PostAsync($"{Orders}/{created.Number}/payments", null, Ct)).StatusCode.ShouldBe(HttpStatusCode.NotFound);

        var guestView = await api.CreateClient().GetFromJsonAsync<OrderDto>(
            $"/api/v1/orders/{created.Number}?token={Uri.EscapeDataString(created.AccessToken)}", TestJson.Options, Ct);
        guestView!.Number.ShouldBe(created.Number);
        (await api.CreateClient().GetAsync($"{Orders}/{created.Number}", Ct)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Guest_checkout_without_an_account_stays_anonymous()
    {
        var product = await api.AddProductAsync("ruchnyi-instrument", "Гостьовий секатор", 320m, stock: 5);
        var phone = CheckoutApiTests.UniquePhone();
        var created = await TestOrders.PlaceAsync(api, product.Id, 1, 320m, phone, new CustomerRequest("Гість Тестовий", phone, Accounts.UniqueEmail()));

        created.Status.ShouldBe(OrderStatus.New);
        created.AccessToken.ShouldNotBeNullOrWhiteSpace();
        (await CustomerOfAsync(created.Number)).ShouldBeNull();
    }

    [Fact]
    public async Task Customer_pays_an_own_card_order_from_the_account()
    {
        var product = await api.AddProductAsync("tekhnika-dlia-sadu-ta-horodu", "Тример для кабінету", 2400m, stock: 3);
        var (client, _) = await Accounts.RegisterAsync(api);
        var body = CheckoutApiTests.Order(product.Id, 1, "2400.00", CheckoutApiTests.UniquePhone()) with
        {
            Delivery = new DeliveryRequest(DeliveryCodes.Pickup, null, null),
            Payment = new PaymentRequest(PaymentCodes.Card),
        };
        var created = await (await new CheckoutApiTests(api).PostOrderAsync(body, Guid.NewGuid().ToString(), client))
            .ReadAsync<OrderCreatedDto>(HttpStatusCode.Created);
        (await client.ReadAsync<PagedResponse<AccountOrderListItemDto>>(Orders)).Items.ShouldHaveSingleItem().CanPay.ShouldBeTrue();

        var start = await (await client.PostAsync($"{Orders}/{created.Number}/payments", null, Ct)).ReadAsync<StartPaymentDto>();
        start.PageUrl.ShouldContain("/pay/sandbox/");
        (await (await client.PostAsync($"{Orders}/{created.Number}/payments", null, Ct)).ReadAsync<StartPaymentDto>())
            .PaymentId.ShouldBe(start.PaymentId);

        var invoiceId = start.PageUrl[(start.PageUrl.LastIndexOf('/') + 1)..];
        var completion = await (await api.CreateClient().PostAsJsonAsync(
                $"/api/v1/payments/sandbox/{invoiceId}/complete",
                new CompleteSandboxPaymentRequest("success", null),
                Ct))
            .ReadAsync<SandboxCompletionDto>();
        completion.RedirectUrl.ShouldEndWith($"/account/orders/{created.Number}?payment=return");

        var paid = await client.ReadAsync<OrderDto>($"{Orders}/{created.Number}");
        paid.PaymentStatus.ShouldBe(PaymentStatus.Succeeded);
        paid.CanPay.ShouldBeFalse();
        var again = await client.PostAsync($"{Orders}/{created.Number}/payments", null, Ct);
        again.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await again.ProblemCodeAsync()).ShouldBe("payments.not_payable");
    }

    private Task<Guid?> CustomerOfAsync(string number) =>
        api.WithDbAsync(db => db.Set<Order>().Where(o => o.Number == number).Select(o => o.CustomerId).SingleAsync(Ct));
}

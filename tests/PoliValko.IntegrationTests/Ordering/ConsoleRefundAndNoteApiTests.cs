using System.Net;
using System.Net.Http.Json;
using PoliValko.Infrastructure.Security.Permissions;
using PoliValko.Ordering.Contracts;
using PoliValko.Ordering.Domain;
using PoliValko.Ordering.Features.Checkout;
using PoliValko.Ordering.Features.Console.Orders;
using PoliValko.Ordering.Features.Console.Refunds;
using PoliValko.SharedKernel;

namespace PoliValko.IntegrationTests;

public sealed class ConsoleRefundAndNoteApiTests(ApiFactory api)
{
    private const string Refunds = "/api/v1/console/refunds";

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Refunds_list_shows_refunds_of_all_orders_with_receipt_state()
    {
        var product = await api.AddProductAsync("hospodarchi-tovary", "Таз для повернення", 260m, stock: 5);
        var created = await TestOrders.PlaceAsync(api, product.Id, 1, 260m, CheckoutApiTests.UniquePhone());
        var admin = await Staff.AdminAsync(api);
        foreach (var status in new[] { "confirmed", "shipped", "completed" })
        {
            (await admin.PostAsJsonAsync($"/api/v1/console/orders/{created.Number}/status", new { status }, Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        }

        await (await admin.PostWithKeyAsync(
                $"/api/v1/console/orders/{created.Number}/refunds",
                new CreateRefundRequest([new RefundLineRequest(product.Id, 1)], "Покупець повернув таз")))
            .ReadAsync<ConsoleOrderDto>();

        var manager = await Staff.ManagerAsync(api);
        var row = (await manager.ReadAsync<PagedResponse<ConsoleRefundRowDto>>($"{Refunds}?q={created.Number}")).Items.ShouldHaveSingleItem();
        row.OrderNumber.ShouldBe(created.Number);
        row.Amount.ShouldBe(new MoneyDto("260.00", "UAH"));
        row.Method.ShouldBe(RefundChannel.Offline);
        row.Status.ShouldBe(RefundStatus.Succeeded);
        row.Reason.ShouldBe("Покупець повернув таз");
        row.CreatedBy.ShouldBe("Адмін Тестовий");
        row.ReceiptStatus.ShouldBeNull();

        await api.ProcessOutboxAsync();
        (await manager.ReadAsync<PagedResponse<ConsoleRefundRowDto>>($"{Refunds}?q={created.Number}&status=succeeded")).Items.ShouldHaveSingleItem().ReceiptStatus.ShouldBe("issued");
        (await manager.ReadAsync<PagedResponse<ConsoleRefundRowDto>>($"{Refunds}?q={created.Number}&status=failed")).Items.ShouldBeEmpty();

        var today = KyivTime.Today(TimeProvider.System);
        var all = await manager.ReadAsync<PagedResponse<ConsoleRefundRowDto>>($"{Refunds}?from={today:yyyy-MM-dd}&to={today:yyyy-MM-dd}&pageSize=100");
        all.Items.Select(r => r.Id).ShouldContain(row.Id);
        all.Items.Select(r => r.CreatedAt).ShouldBeInOrder(SortDirection.Descending);
        (await manager.ReadAsync<PagedResponse<ConsoleRefundRowDto>>($"{Refunds}?q={created.Number}&from={today.AddDays(1):yyyy-MM-dd}")).Items.ShouldBeEmpty();

        foreach (var query in new[] { "status=lost", $"from={today:yyyy-MM-dd}&to={today.AddDays(-1):yyyy-MM-dd}" })
        {
            (await manager.GetAsync($"{Refunds}?{query}", Ct)).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        }

        var outsider = await TestRoles.LoginWithPermissionsAsync(api, admin, PermissionKeys.ProductsView);
        (await outsider.GetAsync(Refunds, Ct)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Internal_note_is_staff_only_and_recorded_in_history()
    {
        var product = await api.AddProductAsync("ruchnyi-instrument", "Лопата з нотаткою", 700m, stock: 5);
        var (customer, me) = await Accounts.RegisterAsync(api);
        var body = CheckoutApiTests.Order(product.Id, 1, "700.00", CheckoutApiTests.UniquePhone());
        var created = await (await new CheckoutApiTests(api).PostOrderAsync(body, Guid.NewGuid().ToString(), customer))
            .ReadAsync<OrderCreatedDto>(HttpStatusCode.Created);
        var manager = await Staff.ManagerAsync(api);

        var noted = await (await manager.PutAsJsonAsync(
                $"/api/v1/console/orders/{created.Number}/note",
                new UpdateOrderNoteRequest("  Покупець просив дзвонити після 18:00  "),
                TestJson.Options,
                Ct))
            .ReadAsync<ConsoleOrderDto>();
        noted.InternalNote.ShouldBe("Покупець просив дзвонити після 18:00");
        noted.CustomerAccountId.ShouldBe(me.Id);
        var entry = noted.History.Last();
        entry.Reason.ShouldBe(OrderStatusChange.NoteChanged);
        entry.From.ShouldBe(OrderStatus.New);
        entry.To.ShouldBe(OrderStatus.New);
        entry.By.ShouldBe("Менеджер Тестовий");

        var same = await (await manager.PutAsJsonAsync(
                $"/api/v1/console/orders/{created.Number}/note",
                new UpdateOrderNoteRequest("Покупець просив дзвонити після 18:00"),
                TestJson.Options,
                Ct))
            .ReadAsync<ConsoleOrderDto>();
        same.History.Count.ShouldBe(noted.History.Count);

        var guestView = await api.CreateClient().GetFromJsonAsync<OrderDto>(
            $"/api/v1/orders/{created.Number}?token={Uri.EscapeDataString(created.AccessToken)}", TestJson.Options, Ct);
        guestView!.History.ShouldHaveSingleItem().Status.ShouldBe(OrderStatus.New);
        (await customer.ReadAsync<OrderDto>($"/api/v1/account/orders/{created.Number}")).History.ShouldHaveSingleItem();
        (await customer.GetStringAsync($"/api/v1/account/orders/{created.Number}", Ct)).ShouldNotContain("18:00");

        var cleared = await (await manager.PutAsJsonAsync($"/api/v1/console/orders/{created.Number}/note", new UpdateOrderNoteRequest(" "), TestJson.Options, Ct))
            .ReadAsync<ConsoleOrderDto>();
        cleared.InternalNote.ShouldBeNull();

        var tooLong = await manager.PutAsJsonAsync($"/api/v1/console/orders/{created.Number}/note", new UpdateOrderNoteRequest(new string('н', 1001)), TestJson.Options, Ct);
        tooLong.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await manager.PutAsJsonAsync("/api/v1/console/orders/PV-000000/note", new UpdateOrderNoteRequest("x"), TestJson.Options, Ct))
            .StatusCode.ShouldBe(HttpStatusCode.NotFound);

        var admin = await Staff.AdminAsync(api);
        var reader = await TestRoles.LoginWithPermissionsAsync(api, admin, PermissionKeys.OrdersView);
        (await reader.ReadAsync<ConsoleOrderDto>($"/api/v1/console/orders/{created.Number}")).InternalNote.ShouldBeNull();
        (await reader.PutAsJsonAsync($"/api/v1/console/orders/{created.Number}/note", new UpdateOrderNoteRequest("x"), TestJson.Options, Ct))
            .StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }
}

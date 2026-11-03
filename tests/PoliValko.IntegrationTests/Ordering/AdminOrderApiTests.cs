using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using System.Text;
using PoliValko.Admin.Features.Summary;
using PoliValko.Identity.Features.Auth;
using PoliValko.Identity.Features.Staff;
using PoliValko.Ordering.Contracts;
using PoliValko.Ordering.Features.Admin.Orders;
using PoliValko.Ordering.Features.Checkout;
using PoliValko.SharedKernel;

namespace PoliValko.IntegrationTests;

public sealed class AdminOrderApiTests(ApiFactory api)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private static DateOnly KyivToday => KyivTime.Today(TimeProvider.System);

    [Fact]
    public async Task Status_change_requires_csrf_follows_transitions_and_records_who_changed_it()
    {
        var product = await api.AddProductAsync("ruchnyi-instrument", "Лопата для адмінки", 1549m, stock: 4);
        var checkout = new CheckoutApiTests(api);
        var phone = CheckoutApiTests.UniquePhone();
        var created = (await (await checkout.PostOrderAsync(CheckoutApiTests.Order(product.Id, 1, "1549.00", phone), Guid.NewGuid().ToString()))
            .Content.ReadFromJsonAsync<OrderCreatedDto>(TestJson.Options, Ct))!;
        var admin = await Staff.SignInAsync(api, ApiFactory.AdminEmail);

        var withoutCsrf = await admin.PostAsJsonAsync($"/api/v1/admin/orders/{created.Number}/status", new { status = "confirmed" }, Ct);
        withoutCsrf.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await withoutCsrf.Content.ReadFromJsonAsync<ProblemBody>(Ct))!.Code.ShouldBe("auth.csrf_invalid");

        var csrf = await admin.GetFromJsonAsync<CsrfTokenDto>("/api/v1/admin/auth/csrf", Ct);
        admin.DefaultRequestHeaders.Add("X-CSRF-TOKEN", csrf!.Token);

        var confirmed = await admin.PostAsJsonAsync(
            $"/api/v1/admin/orders/{created.Number}/status",
            new { status = "confirmed", reason = "Підтвердили наявність телефоном" },
            Ct);
        confirmed.StatusCode.ShouldBe(HttpStatusCode.OK);
        var order = (await confirmed.Content.ReadFromJsonAsync<AdminOrderDto>(TestJson.Options, Ct))!;
        order.Status.ShouldBe(OrderStatus.Confirmed);
        order.PaymentStatus.ShouldBe(PaymentStatus.NotRequired);
        order.Phone.ShouldBe(phone);
        order.History.Last().By.ShouldBe("Адмін Тестовий");
        order.History.Last().Reason.ShouldBe("Підтвердили наявність телефоном");
        order.AllowedTransitions.ShouldBe([OrderStatus.Shipped, OrderStatus.Cancelled]);

        var skipped = await admin.PostAsJsonAsync($"/api/v1/admin/orders/{created.Number}/status", new { status = "completed" }, Ct);
        skipped.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await skipped.Content.ReadFromJsonAsync<ProblemBody>(Ct))!.Code.ShouldBe("ordering.invalid_transition");

        var found = await admin.GetFromJsonAsync<PagedResponse<AdminOrderListItemDto>>(
            $"/api/v1/admin/orders?q={phone[^7..]}",
            TestJson.Options,
            Ct);
        found!.Items.ShouldHaveSingleItem().Number.ShouldBe(created.Number);

        var summary = await admin.GetFromJsonAsync<AdminSummaryDto>("/api/v1/admin/summary", Ct);
        summary.ShouldNotBeNull();

        var users = await admin.GetFromJsonAsync<List<StaffUserDto>>("/api/v1/admin/users", Ct);
        users!.Select(u => u.Email).ShouldContain(ApiFactory.ManagerEmail);
    }

    [Fact]
    public async Task Status_filters_accept_values_as_the_api_writes_them()
    {
        var product = await api.AddProductAsync("ruchnyi-instrument", "Граблі для фільтра", 399m, stock: 3);
        var checkout = new CheckoutApiTests(api);
        var created = (await (await checkout.PostOrderAsync(CheckoutApiTests.Order(product.Id, 1, "399.00", CheckoutApiTests.UniquePhone()), Guid.NewGuid().ToString()))
            .Content.ReadFromJsonAsync<OrderCreatedDto>(TestJson.Options, Ct))!;
        var manager = await Staff.SignInAsync(api, ApiFactory.ManagerEmail);

        foreach (var value in new[] { "new", "New", "NEW" })
        {
            var page = await manager.GetFromJsonAsync<PagedResponse<AdminOrderListItemDto>>($"/api/v1/admin/orders?status={value}&pageSize=100", TestJson.Options, Ct);
            page!.Items.ShouldAllBe(o => o.Status == OrderStatus.New);
            page.Items.Select(o => o.Number).ShouldContain(created.Number);
        }

        var awaiting = await manager.GetFromJsonAsync<PagedResponse<AdminOrderListItemDto>>("/api/v1/admin/orders?status=awaitingConfirmation", TestJson.Options, Ct);
        awaiting!.Items.ShouldAllBe(o => o.Status == OrderStatus.AwaitingConfirmation);

        var requests = await manager.GetAsync("/api/v1/admin/service-requests?status=inProgress", Ct);
        requests.StatusCode.ShouldBe(HttpStatusCode.OK);

        foreach (var url in new[] { "/api/v1/admin/orders?status=lost", "/api/v1/admin/orders?status=1", "/api/v1/admin/service-requests?status=closed" })
        {
            var invalid = await manager.GetAsync(url, Ct);
            invalid.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
            (await invalid.Content.ReadAsStringAsync(Ct)).ShouldContain("Допустимі значення");
        }
    }

    [Fact]
    public async Task Order_list_filters_sort_and_counts_share_the_same_rules()
    {
        var phone = CheckoutApiTests.UniquePhone();
        var cheap = await api.AddProductAsync("vse-dlia-polyvu", "Дощувач для фільтрів", 120m, stock: 5);
        var dear = await api.AddProductAsync("vse-dlia-polyvu", "Насос для фільтрів", 860m, stock: 5);
        var first = await TestOrders.PlaceAsync(api, cheap.Id, 1, 120m, phone);
        var second = await TestOrders.PlaceAsync(api, dear.Id, 1, 860m, phone);
        var manager = await Staff.ManagerAsync(api);
        var digits = phone[^7..];
        var today = Day(KyivToday);

        var filtered = await ListOrdersAsync(manager, $"q={digits}&paymentStatus=notRequired&delivery=nova_poshta&from={today}&to={today}&sort=totalDesc");
        filtered.Items.Select(o => o.Number).ShouldBe([second.Number, first.Number]);
        (await ListOrdersAsync(manager, $"q={digits}&sort=totalAsc")).Items.Select(o => o.Number).ShouldBe([first.Number, second.Number]);
        (await ListOrdersAsync(manager, $"q={digits}&sort=oldest")).Items.Select(o => o.Number).ShouldBe([first.Number, second.Number]);
        (await ListOrdersAsync(manager, $"q={digits}")).Items.Select(o => o.Number).ShouldBe([second.Number, first.Number]);

        (await ListOrdersAsync(manager, $"q={digits}&delivery=pickup")).Items.ShouldBeEmpty();
        (await ListOrdersAsync(manager, $"q={digits}&paymentStatus=pending")).Items.ShouldBeEmpty();
        (await ListOrdersAsync(manager, $"q={digits}&from={Day(KyivToday.AddDays(1))}")).Items.ShouldBeEmpty();
        (await ListOrdersAsync(manager, $"q={digits}&to={Day(KyivToday.AddDays(-1))}")).Items.ShouldBeEmpty();

        var byTotal = await ListOrdersAsync(manager, "sort=totalDesc&pageSize=100");
        byTotal.Items.Select(o => Amount(o.Total)).ShouldBeInOrder(SortDirection.Descending);

        foreach (var (query, field) in new[]
                 {
                     ("delivery=courier", "delivery"),
                     ("sort=cheapest", "sort"),
                     ("paymentStatus=paidd", "paymentStatus"),
                     ($"from={today}&to={Day(KyivToday.AddDays(-1))}", "from"),
                 })
        {
            var invalid = await manager.GetAsync($"/api/v1/admin/orders?{query}", Ct);
            invalid.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
            (await invalid.Content.ReadFromJsonAsync<ProblemBody>(Ct))!.Errors!.ShouldContainKey(field);
        }

        var counts = await manager.ReadAsync<AdminOrderCountsDto>($"/api/v1/admin/orders/counts?q={digits}&from={today}&to={today}");
        counts.All.ShouldBe(2);
        counts.ByStatus.ShouldHaveSingleItem().ShouldBe(new OrderStatusCountDto(OrderStatus.New, 2));

        var everything = await manager.ReadAsync<AdminOrderCountsDto>("/api/v1/admin/orders/counts");
        everything.All.ShouldBeGreaterThanOrEqualTo(everything.ByStatus.Sum(s => s.Count));
        everything.ByStatus.ShouldContain(s => s.Status == OrderStatus.New && s.Count >= 2);
        everything.ByStatus.ShouldAllBe(s => s.Count > 0);

        var none = await manager.ReadAsync<AdminOrderCountsDto>($"/api/v1/admin/orders/counts?q={digits}&delivery=pickup");
        none.All.ShouldBe(0);
        none.ByStatus.ShouldBeEmpty();
    }

    [Fact]
    public async Task Export_returns_csv_for_excel_with_the_filtered_orders()
    {
        var product = await api.AddProductAsync("ruchnyi-instrument", "Секатор для вивантаження", 899m, stock: 5);
        var created = await TestOrders.PlaceAsync(api, product.Id, 1, 899m, CheckoutApiTests.UniquePhone());
        var manager = await Staff.ManagerAsync(api);

        var response = await manager.GetAsync($"/api/v1/admin/orders/export?q={created.Number}&status=new", Ct);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        response.Content.Headers.ContentType!.MediaType.ShouldBe("text/csv");
        response.Content.Headers.ContentType.CharSet.ShouldBe("utf-8");
        response.Content.Headers.ContentDisposition!.DispositionType.ShouldBe("attachment");
        response.Content.Headers.ContentDisposition.FileName!.Trim('"').ShouldBe($"polivalko-orders-{KyivToday:yyyyMMdd}.csv");

        var bytes = await response.Content.ReadAsByteArrayAsync(Ct);
        bytes[..3].ShouldBe(new byte[] { 0xEF, 0xBB, 0xBF });
        var lines = Encoding.UTF8.GetString(bytes, 3, bytes.Length - 3).Split("\r\n", StringSplitOptions.RemoveEmptyEntries);
        lines[0].ShouldBe("Номер;Дата;Покупець;Телефон;Email;Статус;Оплата;Спосіб оплати;Отримання;Позицій;Сума;Повернено");
        var row = lines.Where(l => l.StartsWith(created.Number + ";", StringComparison.Ordinal)).ShouldHaveSingleItem();
        row.ShouldContain(";Олена Тестова;");
        row.ShouldEndWith(";Нове;Оплата під час отримання;Післяплата;Нова пошта;1;899,00;0,00");

        var invalid = await manager.GetAsync("/api/v1/admin/orders/export?sort=random", Ct);
        invalid.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    private static Task<PagedResponse<AdminOrderListItemDto>> ListOrdersAsync(HttpClient client, string query) =>
        client.ReadAsync<PagedResponse<AdminOrderListItemDto>>($"/api/v1/admin/orders?{query}");

    private static decimal Amount(MoneyDto money) => decimal.Parse(money.Value, CultureInfo.InvariantCulture);

    private static string Day(DateOnly date) => date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
}

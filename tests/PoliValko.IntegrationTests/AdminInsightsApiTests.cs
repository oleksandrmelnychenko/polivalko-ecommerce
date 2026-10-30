using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using System.Text;
using PoliValko.Api;
using PoliValko.Catalog.Api;
using PoliValko.Identity;
using PoliValko.Ordering.Api;
using PoliValko.Ordering.Domain;
using PoliValko.SharedKernel;

namespace PoliValko.IntegrationTests;

/// <summary>Зведення, фільтри й вивантаження замовлень, покупці, пошук і масові дії з товарами в адмінці.</summary>
public sealed class AdminInsightsApiTests(ApiFactory api)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private static DateOnly KyivToday => KyivTime.Today(TimeProvider.System);

    [Fact]
    public async Task Dashboard_shows_every_kyiv_day_and_counts_a_new_order()
    {
        var manager = await Staff.ManagerAsync(api);
        var before = await GetAsync<AdminDashboardDto>(manager, "/api/v1/admin/dashboard");
        var product = await api.AddProductAsync("ruchnyi-instrument", "Мотика для зведення", 731m, stock: 5);

        await PlaceOrderAsync(product.Id, 2, 731m, CheckoutApiTests.UniquePhone());

        var after = await GetAsync<AdminDashboardDto>(manager, "/api/v1/admin/dashboard");
        after.Days.ShouldBe(30);
        after.ByDay.Count.ShouldBe(30);
        after.ByDay[^1].Date.ShouldBe(KyivToday);
        after.ByDay[0].Date.ShouldBe(KyivToday.AddDays(-29));
        after.Current.Orders.ShouldBe(before.Current.Orders + 1);
        Amount(after.Current.Revenue).ShouldBe(Amount(before.Current.Revenue) + 1462m);
        after.ByDay.Sum(d => d.Orders).ShouldBe(after.Current.Orders);
        after.ByStatus.Sum(s => s.Count).ShouldBe(after.Current.Orders);
        after.ByStatus.ShouldContain(s => s.Status == OrderStatus.New);
        after.ByStatus.Select(s => s.Status).ShouldBeInOrder();
        after.ByDelivery.ShouldContain(d => d.Method == DeliveryCodes.NovaPoshta);
        after.TopProducts.Count.ShouldBeLessThanOrEqualTo(5);
        after.LowStock.Count.ShouldBeLessThanOrEqualTo(8);
        after.LowStock.ShouldAllBe(p => p.Stock <= 3);

        var week = await GetAsync<AdminDashboardDto>(manager, "/api/v1/admin/dashboard?days=7");
        week.ByDay.Count.ShouldBe(7);
        week.ByDay[^1].Date.ShouldBe(KyivToday);

        var invalid = await manager.GetAsync("/api/v1/admin/dashboard?days=5", Ct);
        invalid.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await invalid.Content.ReadFromJsonAsync<ProblemBody>(Ct))!.Errors!.ShouldContainKey("days");
    }

    [Fact]
    public async Task Order_list_filters_sort_and_counts_share_the_same_rules()
    {
        var phone = CheckoutApiTests.UniquePhone();
        var cheap = await api.AddProductAsync("vse-dlia-polyvu", "Дощувач для фільтрів", 120m, stock: 5);
        var dear = await api.AddProductAsync("vse-dlia-polyvu", "Насос для фільтрів", 860m, stock: 5);
        var first = await PlaceOrderAsync(cheap.Id, 1, 120m, phone);
        var second = await PlaceOrderAsync(dear.Id, 1, 860m, phone);
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

        var counts = await GetAsync<AdminOrderCountsDto>(manager, $"/api/v1/admin/orders/counts?q={digits}&from={today}&to={today}");
        counts.All.ShouldBe(2);
        counts.ByStatus.ShouldHaveSingleItem().ShouldBe(new OrderStatusCountDto(OrderStatus.New, 2));

        var everything = await GetAsync<AdminOrderCountsDto>(manager, "/api/v1/admin/orders/counts");
        everything.All.ShouldBeGreaterThanOrEqualTo(everything.ByStatus.Sum(s => s.Count));
        everything.ByStatus.ShouldContain(s => s.Status == OrderStatus.New && s.Count >= 2);
        everything.ByStatus.ShouldAllBe(s => s.Count > 0);

        var none = await GetAsync<AdminOrderCountsDto>(manager, $"/api/v1/admin/orders/counts?q={digits}&delivery=pickup");
        none.All.ShouldBe(0);
        none.ByStatus.ShouldBeEmpty();
    }

    [Fact]
    public async Task Export_returns_csv_for_excel_with_the_filtered_orders()
    {
        var product = await api.AddProductAsync("ruchnyi-instrument", "Секатор для вивантаження", 899m, stock: 5);
        var created = await PlaceOrderAsync(product.Id, 1, 899m, CheckoutApiTests.UniquePhone());
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

    [Fact]
    public async Task Customers_are_aggregated_by_phone()
    {
        var phone = CheckoutApiTests.UniquePhone();
        var email = $"taras.{phone[^7..]}@example.com";
        var product = await api.AddProductAsync("vse-dlia-roslyn", "Горщик для покупців", 150m, stock: 10);
        await PlaceOrderAsync(product.Id, 2, 150m, phone, new CustomerRequest("Тарас Покупець", phone, email));
        var last = await PlaceOrderAsync(product.Id, 3, 150m, phone);
        var manager = await Staff.ManagerAsync(api);

        var page = await GetAsync<PagedResponse<AdminCustomerDto>>(manager, $"/api/v1/admin/customers?q={Uri.EscapeDataString(phone)}");

        // Ім'я — з останнього замовлення, email — останній непорожній (в останньому його немає).
        var customer = page.Items.ShouldHaveSingleItem();
        customer.Phone.ShouldBe(phone);
        customer.Name.ShouldBe("Олена Тестова");
        customer.Email.ShouldBe(email);
        customer.Orders.ShouldBe(2);
        customer.TotalSpent.ShouldBe(MoneyDto.Hryvnia(750m));
        customer.LastOrderNumber.ShouldBe(last.Number);
        customer.FirstOrderAt.ShouldBeLessThanOrEqualTo(customer.LastOrderAt);

        // Пошук за ім'ям з будь-якого замовлення покупця, без урахування регістру, і за email.
        foreach (var q in new[] { "тарас ПОКУПЕЦЬ", email.ToUpperInvariant() })
        {
            var found = await GetAsync<PagedResponse<AdminCustomerDto>>(manager, $"/api/v1/admin/customers?q={Uri.EscapeDataString(q)}");
            found.Items.ShouldHaveSingleItem().Orders.ShouldBe(2);
        }

        var bySpent = await GetAsync<PagedResponse<AdminCustomerDto>>(manager, "/api/v1/admin/customers?sort=totalSpent&pageSize=100");
        bySpent.Items.Select(c => Amount(c.TotalSpent)).ShouldBeInOrder(SortDirection.Descending);
        var byOrders = await GetAsync<PagedResponse<AdminCustomerDto>>(manager, "/api/v1/admin/customers?sort=orders&pageSize=100");
        byOrders.Items.Select(c => c.Orders).ShouldBeInOrder(SortDirection.Descending);

        var invalid = await manager.GetAsync("/api/v1/admin/customers?sort=name", Ct);
        invalid.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await invalid.Content.ReadFromJsonAsync<ProblemBody>(Ct))!.Errors!.ShouldContainKey("sort");
    }

    [Fact]
    public async Task Search_finds_orders_products_and_customers()
    {
        var phone = CheckoutApiTests.UniquePhone();
        var product = await api.AddProductAsync("ruchnyi-instrument", "Культиватор для пошуку", 1320m, stock: 5);
        var created = await PlaceOrderAsync(product.Id, 1, 1320m, phone);
        var manager = await Staff.ManagerAsync(api);

        var byNumber = await GetAsync<AdminSearchDto>(manager, $"/api/v1/admin/search?q={created.Number.ToLowerInvariant()}");
        var hit = byNumber.Orders.ShouldHaveSingleItem();
        hit.Number.ShouldBe(created.Number);
        hit.Phone.ShouldBe(phone);
        hit.Total.ShouldBe(MoneyDto.Hryvnia(1320m));

        var bySku = await GetAsync<AdminSearchDto>(manager, $"/api/v1/admin/search?q={product.Sku.ToLowerInvariant()}");
        var found = bySku.Products.ShouldHaveSingleItem();
        found.Id.ShouldBe(product.Id);
        found.Price.ShouldBe(MoneyDto.Hryvnia(1320m));
        found.IsVisible.ShouldBeTrue();

        var byPhone = await GetAsync<AdminSearchDto>(manager, $"/api/v1/admin/search?q={Uri.EscapeDataString(phone)}");
        byPhone.Customers.ShouldHaveSingleItem().ShouldBe(new SearchCustomerHitDto(phone, "Олена Тестова", 1));

        var tooShort = await GetAsync<AdminSearchDto>(manager, "/api/v1/admin/search?q=%20P%20");
        tooShort.Orders.ShouldBeEmpty();
        tooShort.Products.ShouldBeEmpty();
        tooShort.Customers.ShouldBeEmpty();
    }

    [Fact]
    public async Task Stock_filter_and_bulk_visibility_hide_products_from_storefront()
    {
        var soldOut = await api.AddProductAsync("hospodarchi-tovary", "Відро розпродане", 80m, stock: 0);
        var few = await api.AddProductAsync("hospodarchi-tovary", "Відро, що закінчується", 85m, stock: 2);
        var plenty = await api.AddProductAsync("hospodarchi-tovary", "Відро в наявності", 90m, stock: 40);
        var manager = await Staff.ManagerAsync(api);

        (await ListProductsAsync(manager, soldOut.Sku, "out")).ShouldHaveSingleItem().Id.ShouldBe(soldOut.Id);
        (await ListProductsAsync(manager, soldOut.Sku, "in")).ShouldBeEmpty();
        (await ListProductsAsync(manager, few.Sku, "low")).ShouldHaveSingleItem().Id.ShouldBe(few.Id);
        (await ListProductsAsync(manager, few.Sku, "out")).ShouldBeEmpty();
        (await ListProductsAsync(manager, plenty.Sku, "in")).ShouldHaveSingleItem().Id.ShouldBe(plenty.Id);
        (await ListProductsAsync(manager, plenty.Sku, "low")).ShouldBeEmpty();
        (await manager.GetAsync("/api/v1/admin/catalog/products?stock=few", Ct)).StatusCode.ShouldBe(HttpStatusCode.BadRequest);

        var request = new SetProductsVisibilityRequest([few.Id, plenty.Id], false);
        var withoutCsrf = await (await LoginWithoutCsrfAsync()).PostAsJsonAsync("/api/v1/admin/catalog/products/visibility", request, TestJson.Options, Ct);
        withoutCsrf.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await withoutCsrf.Content.ReadFromJsonAsync<ProblemBody>(Ct))!.Code.ShouldBe("auth.csrf_invalid");

        var hidden = await (await manager.PostAsJsonAsync("/api/v1/admin/catalog/products/visibility", request, TestJson.Options, Ct))
            .ReadAsync<SetProductsVisibilityResult>();
        hidden.Updated.ShouldBe(2);

        var again = await (await manager.PostAsJsonAsync("/api/v1/admin/catalog/products/visibility", request, TestJson.Options, Ct))
            .ReadAsync<SetProductsVisibilityResult>();
        again.Updated.ShouldBe(0);

        var storefront = api.CreateClient();
        (await storefront.GetAsync($"/api/v1/products/{few.Slug}", Ct)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await storefront.GetAsync($"/api/v1/products/{plenty.Slug}", Ct)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await ListProductsAsync(manager, plenty.Sku, null)).ShouldHaveSingleItem().IsVisible.ShouldBeFalse();

        foreach (var (body, field) in new (object, string)[]
                 {
                     (new SetProductsVisibilityRequest([], true), "productIds"),
                     (new SetProductsVisibilityRequest([few.Id], null), "visible"),
                     (new SetProductsVisibilityRequest([Guid.NewGuid()], true), "productIds"),
                 })
        {
            var invalid = await manager.PostAsJsonAsync("/api/v1/admin/catalog/products/visibility", body, TestJson.Options, Ct);
            invalid.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
            (await invalid.Content.ReadFromJsonAsync<ProblemBody>(Ct))!.Errors!.ShouldContainKey(field);
        }
    }

    private async Task<OrderCreatedDto> PlaceOrderAsync(Guid productId, int quantity, decimal unitPrice, string phone, CustomerRequest? customer = null)
    {
        var total = (unitPrice * quantity).ToString("0.00", CultureInfo.InvariantCulture);
        var body = CheckoutApiTests.Order(productId, quantity, total, phone);
        var response = await new CheckoutApiTests(api).PostOrderAsync(customer is null ? body : body with { Customer = customer }, Guid.NewGuid().ToString());
        return await response.ReadAsync<OrderCreatedDto>(HttpStatusCode.Created);
    }

    private static async Task<T> GetAsync<T>(HttpClient client, string url) =>
        await (await client.GetAsync(url, Ct)).ReadAsync<T>();

    private static Task<PagedResponse<AdminOrderListItemDto>> ListOrdersAsync(HttpClient client, string query) =>
        GetAsync<PagedResponse<AdminOrderListItemDto>>(client, $"/api/v1/admin/orders?{query}");

    private static async Task<IReadOnlyList<AdminProductListItemDto>> ListProductsAsync(HttpClient client, string sku, string? stock) =>
        (await GetAsync<PagedResponse<AdminProductListItemDto>>(client, $"/api/v1/admin/catalog/products?q={sku}{(stock is null ? string.Empty : $"&stock={stock}")}")).Items;

    private async Task<HttpClient> LoginWithoutCsrfAsync()
    {
        var client = api.CreateClient();
        var response = await client.PostAsJsonAsync("/api/v1/admin/auth/login", new LoginRequest(ApiFactory.ManagerEmail, ApiFactory.TestPassword), Ct);
        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        return client;
    }

    private static decimal Amount(MoneyDto money) => decimal.Parse(money.Value, CultureInfo.InvariantCulture);

    private static string Day(DateOnly date) => date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
}

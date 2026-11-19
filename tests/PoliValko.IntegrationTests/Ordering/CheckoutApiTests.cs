using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Domain;
using PoliValko.Delivery.Features.Storefront;
using PoliValko.Delivery.Contracts;
using PoliValko.Ordering.Contracts;
using PoliValko.Ordering.Domain;
using PoliValko.Ordering.Features.Checkout;
using PoliValko.Ordering.Jobs;
using PoliValko.SharedKernel;

namespace PoliValko.IntegrationTests;

public sealed class CheckoutApiTests(ApiFactory api)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private readonly HttpClient _client = api.CreateClient();

    [Fact]
    public async Task Separate_recipient_and_comment_are_saved_without_replacing_buyer()
    {
        var product = await api.AddProductAsync("ruchnyi-instrument", "Товар іншому отримувачу", 125m, stock: 3);
        var request = Order(product.Id, 1, "125.00", UniquePhone()) with
        {
            Recipient = new RecipientRequest("  Іван Отримувач  ", "067 123 45 67"),
            Comment = "  Передати після 15:00  ",
        };
        var response = await PostOrderAsync(request, Guid.NewGuid().ToString());
        response.StatusCode.ShouldBe(HttpStatusCode.Created);
        var created = (await response.Content.ReadFromJsonAsync<OrderCreatedDto>(TestJson.Options, Ct))!;
        var stored = await api.WithDbAsync(db => db.Set<Order>().AsNoTracking().SingleAsync(o => o.Number == created.Number, Ct));
        stored.CustomerName.ShouldBe(request.Customer!.Name);
        stored.CustomerPhone.ShouldBe(request.Customer.Phone);
        stored.RecipientName.ShouldBe("Іван Отримувач");
        stored.RecipientPhone.ShouldBe("+380671234567");
        stored.Comment.ShouldBe("Передати після 15:00");
        var view = await _client.GetFromJsonAsync<OrderDto>($"/api/v1/orders/{created.Number}?token={Uri.EscapeDataString(created.AccessToken)}", TestJson.Options, Ct);
        view!.Delivery.RecipientName.ShouldBe("Іван Отримувач");
        view.Delivery.RecipientPhone.ShouldBe("+380 67 *** ** 67");
    }

    [Theory]
    [InlineData("", "+380671234567", "recipient.name")]
    [InlineData("Іван Отримувач", "123", "recipient.phone")]
    public async Task Invalid_recipient_is_rejected_without_creating_order(string name, string phone, string field)
    {
        var product = await api.AddProductAsync("ruchnyi-instrument", "Товар для перевірки отримувача", 100m);
        var key = Guid.NewGuid().ToString();
        var request = Order(product.Id, 1, "100.00", UniquePhone()) with { Recipient = new RecipientRequest(name, phone) };
        var response = await PostOrderAsync(request, key);
        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await response.Content.ReadFromJsonAsync<ProblemBody>(Ct))!.Errors!.Keys.ShouldContain(field);
        (await api.WithDbAsync(db => db.Set<Order>().CountAsync(o => o.IdempotencyKey == key, Ct))).ShouldBe(0);
    }

    [Fact]
    public async Task Quote_prices_lines_on_server_and_flags_stock_issues()
    {
        var plenty = await api.AddProductAsync("vse-dlia-polyvu", "Шланг для розрахунку", 450m, stock: 10);
        var few = await api.AddProductAsync("vse-dlia-polyvu", "Таймер для розрахунку", 1200m, stock: 1);
        var none = await api.AddProductAsync("vse-dlia-polyvu", "Розпроданий товар", 99m, stock: 0);

        var response = await _client.PostAsJsonAsync(
            "/api/v1/checkout/quote",
            new QuoteRequest([new(plenty.Id, 2), new(few.Id, 3), new(none.Id, 1)]),
            TestJson.Options,
            Ct);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var quote = (await response.Content.ReadFromJsonAsync<QuoteDto>(TestJson.Options, Ct))!;
        quote.Items[0].Issue.ShouldBeNull();
        quote.Items[0].LineTotal.ShouldBe(new MoneyDto("900.00", "UAH"));
        quote.Items[1].Issue.ShouldBe(QuoteIssues.InsufficientStock);
        quote.Items[1].AvailableQuantity.ShouldBe(1);
        quote.Items[2].Issue.ShouldBe(QuoteIssues.Unavailable);
        quote.Subtotal.ShouldBe(new MoneyDto("4500.00", "UAH"));
        quote.DeliveryMethods.Select(d => d.Code).ShouldBe([DeliveryCodes.NovaPoshta, DeliveryCodes.NovaPoshtaCourier, DeliveryCodes.Pickup]);
        quote.DataFresh.ShouldBeTrue();
    }

    [Fact]
    public async Task Cash_on_delivery_order_is_created_and_visible_only_with_token()
    {
        var product = await api.AddProductAsync("ruchnyi-instrument", "Секатор для замовлення", 1189m, stock: 5);

        var response = await PostOrderAsync(Order(product.Id, 2, "2378.00", UniquePhone()), Guid.NewGuid().ToString());

        response.StatusCode.ShouldBe(HttpStatusCode.Created);
        var created = (await response.Content.ReadFromJsonAsync<OrderCreatedDto>(TestJson.Options, Ct))!;
        created.Number.ShouldStartWith("PV-");
        created.Status.ShouldBe(OrderStatus.New);
        created.PaymentStatus.ShouldBe(PaymentStatus.NotRequired);
        created.PaymentRequired.ShouldBeFalse();
        created.Total.ShouldBe(new MoneyDto("2378.00", "UAH"));

        var view = await _client.GetFromJsonAsync<OrderDto>(
            $"/api/v1/orders/{created.Number}?token={Uri.EscapeDataString(created.AccessToken)}",
            TestJson.Options,
            Ct);
        view!.Items.ShouldHaveSingleItem().Quantity.ShouldBe(2);
        view.Customer.Phone.ShouldStartWith("+380 67 *** **");
        view.Delivery.SettlementName.ShouldBe("Буча");
        view.Delivery.WarehouseName!.ShouldStartWith("Відділення №1");
        view.PaymentMethod.ShouldBe(PaymentCodes.CashOnDelivery);
        view.History.ShouldHaveSingleItem().Status.ShouldBe(OrderStatus.New);

        (await _client.GetAsync($"/api/v1/orders/{created.Number}", Ct)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        var wrongToken = await _client.GetAsync($"/api/v1/orders/{created.Number}?token=wrong", Ct);
        wrongToken.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await wrongToken.Content.ReadFromJsonAsync<ProblemBody>(Ct))!.Code.ShouldBe("ordering.order_not_found");
    }

    [Fact]
    public async Task Order_requires_email_and_mails_the_order_link()
    {
        var product = await api.AddProductAsync("ruchnyi-instrument", "Рукавиці для листа", 150m, stock: 5);
        var phone = UniquePhone();

        var withoutEmail = Order(product.Id, 1, "150.00", phone) with { Customer = new CustomerRequest("Олена Тестова", phone, " ") };
        var rejected = await PostOrderAsync(withoutEmail, Guid.NewGuid().ToString());
        rejected.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await rejected.Content.ReadAsStringAsync(Ct)).ShouldContain("customer.email");

        foreach (var notAnAddress in new[] { "Олена <olena@example.com>", "olena tester@example.com", "a@example.com, b@example.com", "olena@localhost" })
        {
            var odd = Order(product.Id, 1, "150.00", phone) with { Customer = new CustomerRequest("Олена Тестова", phone, notAnAddress) };
            var refused = await PostOrderAsync(odd, Guid.NewGuid().ToString());
            refused.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
            (await refused.Content.ReadAsStringAsync(Ct)).ShouldContain("customer.email");
        }

        var email = Accounts.UniqueEmail("guest");
        var body = Order(product.Id, 1, "150.00", phone) with { Customer = new CustomerRequest("Олена Тестова", phone, email) };
        var created = await (await PostOrderAsync(body, Guid.NewGuid().ToString())).ReadAsync<OrderCreatedDto>(HttpStatusCode.Created);

        api.Mailer.To(email, MailKind.OrderPlaced).ShouldHaveSingleItem().Link.ShouldContain($"/order/{created.Number}?token=");
        api.Mailer.LastToken(email, MailKind.OrderPlaced).ShouldBe(created.AccessToken);

        var view = await _client.GetFromJsonAsync<OrderDto>(
            $"/api/v1/orders/{created.Number}?token={Uri.EscapeDataString(created.AccessToken)}",
            TestJson.Options,
            Ct);
        view!.Customer.Email.ShouldBe($"g***{email[email.IndexOf('@')..]}");
    }

    [Fact]
    public async Task Expiry_releases_only_reservations_for_old_unconfirmed_orders()
    {
        var product = await api.AddProductAsync("ruchnyi-instrument", "Резерв до підтвердження", 150m, stock: 3);

        async Task<string> CreateOrderAsync() => (await (await PostOrderAsync(
            Order(product.Id, 1, "150.00", UniquePhone()), Guid.NewGuid().ToString()))
            .ReadAsync<OrderCreatedDto>(HttpStatusCode.Created)).Number;

        var expired = await CreateOrderAsync();
        var confirmed = await CreateOrderAsync();
        var recent = await CreateOrderAsync();
        var past = DateTimeOffset.UtcNow.AddDays(-3);
        await api.WithDbAsync(db => db.Set<Order>().Where(o => o.Number == expired || o.Number == confirmed)
            .ExecuteUpdateAsync(s => s.SetProperty(o => o.CreatedAt, past), Ct));
        await api.WithDbAsync(db => db.Set<Order>().Where(o => o.Number == confirmed)
            .ExecuteUpdateAsync(s => s.SetProperty(o => o.Status, OrderStatus.Confirmed), Ct));

        await api.WithScopeAsync(services => UnpaidOrderExpiryJob.ExpireAsync(services, Ct));

        var states = await api.WithDbAsync(db => db.Set<Order>()
            .Where(o => o.Number == expired || o.Number == confirmed || o.Number == recent)
            .ToDictionaryAsync(o => o.Number, o => o.Status, Ct));
        states[expired].ShouldBe(OrderStatus.Cancelled);
        states[confirmed].ShouldBe(OrderStatus.Confirmed);
        states[recent].ShouldBe(OrderStatus.New);
        (await api.WithDbAsync(db => db.Set<ProductStock>().Where(s => s.ProductId == product.Id)
            .Select(s => s.ReservedQuantity).SingleAsync(Ct))).ShouldBe(2m);
    }

    [Fact]
    public async Task Changed_total_is_reported_before_the_order_is_created()
    {
        var product = await api.AddProductAsync("vse-dlia-roslyn", "Ґрунт зі зміненою ціною", 189m, stock: 20);

        var response = await PostOrderAsync(Order(product.Id, 1, "150.00", UniquePhone()), Guid.NewGuid().ToString());

        response.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        var problem = await response.Content.ReadFromJsonAsync<PriceChangedProblem>(TestJson.Options, Ct);
        problem!.Code.ShouldBe("checkout.price_changed");
        problem.Total.ShouldBe(new MoneyDto("189.00", "UAH"));
    }

    [Fact]
    public async Task Insufficient_stock_rejects_the_order()
    {
        var product = await api.AddProductAsync("vse-dlia-roslyn", "Останній мішок ґрунту", 100m, stock: 1);

        var response = await PostOrderAsync(Order(product.Id, 3, "300.00", UniquePhone()), Guid.NewGuid().ToString());

        response.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await response.Content.ReadFromJsonAsync<ProblemBody>(Ct))!.Code.ShouldBe("checkout.insufficient_stock");
    }

    [Fact]
    public async Task Repeated_request_with_same_key_creates_one_order()
    {
        var product = await api.AddProductAsync("hospodarchi-tovary", "Відро для ідемпотентності", 315m, stock: 9);
        var phone = UniquePhone();
        var key = Guid.NewGuid().ToString();
        var body = Order(product.Id, 1, "315.00", phone);

        var first = await PostOrderAsync(body, key);
        var second = await PostOrderAsync(body, key);

        first.StatusCode.ShouldBe(HttpStatusCode.Created);
        second.StatusCode.ShouldBe(HttpStatusCode.Created);
        second.Headers.GetValues("Idempotent-Replayed").ShouldBe(["true"]);
        (await second.Content.ReadFromJsonAsync<OrderCreatedDto>(TestJson.Options, Ct))!.Number
            .ShouldBe((await first.Content.ReadFromJsonAsync<OrderCreatedDto>(TestJson.Options, Ct))!.Number);
        (await api.WithDbAsync(db => db.Set<Order>().CountAsync(o => o.CustomerPhone == phone, Ct))).ShouldBe(1);
    }

    [Fact]
    public async Task Concurrent_requests_with_same_key_create_one_order_and_replay_after_completion()
    {
        var product = await api.AddProductAsync("hospodarchi-tovary", "Одночасне оформлення", 315m, stock: 9);
        var key = Guid.NewGuid().ToString();
        var body = Order(product.Id, 1, "315.00", UniquePhone());

        var responses = await Task.WhenAll(Enumerable.Range(0, 8).Select(_ => PostOrderAsync(body, key)));
        var createdNumbers = new List<string>();
        foreach (var response in responses)
        {
            using (response)
            {
                if (response.StatusCode == HttpStatusCode.Created)
                    createdNumbers.Add((await response.Content.ReadFromJsonAsync<OrderCreatedDto>(TestJson.Options, Ct))!.Number);
                else
                {
                    response.StatusCode.ShouldBe(HttpStatusCode.Conflict);
                    (await response.Content.ReadFromJsonAsync<ProblemBody>(Ct))!.Code.ShouldBe("idempotency.in_progress");
                }
            }
        }

        createdNumbers.ShouldNotBeEmpty();
        createdNumbers.Distinct().ShouldHaveSingleItem();
        using var replay = await PostOrderAsync(body, key);
        replay.StatusCode.ShouldBe(HttpStatusCode.Created);
        replay.Headers.GetValues("Idempotent-Replayed").ShouldBe(["true"]);
        (await replay.Content.ReadFromJsonAsync<OrderCreatedDto>(TestJson.Options, Ct))!.Number.ShouldBe(createdNumbers[0]);
        (await api.WithDbAsync(db => db.Set<Order>().CountAsync(o => o.IdempotencyKey == key, Ct))).ShouldBe(1);
    }

    [Fact]
    public async Task Replay_is_bound_to_customer_and_rejects_guest_transitions_and_legacy_records()
    {
        var product = await api.AddProductAsync("hospodarchi-tovary", "Ізоляція повторів", 50m, stock: 20);
        var body = Order(product.Id, 1, "50.00", UniquePhone());
        var key = Guid.NewGuid().ToString();
        var (owner, _) = await Accounts.RegisterAsync(api);
        var (other, _) = await Accounts.RegisterAsync(api);
        var first = await PostOrderAsync(body, key, owner);
        first.StatusCode.ShouldBe(HttpStatusCode.Created);
        var firstBody = await first.Content.ReadFromJsonAsync<OrderCreatedDto>(TestJson.Options, Ct);
        foreach (var client in new[] { other, _client })
        {
            var denied = await PostOrderAsync(body, key, client);
            denied.StatusCode.ShouldBe(HttpStatusCode.Conflict);
            (await denied.Content.ReadFromJsonAsync<ProblemBody>(Ct))!.Code.ShouldBe("idempotency.owner_mismatch");
            denied.Headers.Contains("Idempotent-Replayed").ShouldBeFalse();
        }
        var replay = await PostOrderAsync(body, key, owner);
        (await replay.Content.ReadFromJsonAsync<OrderCreatedDto>(TestJson.Options, Ct)).ShouldBe(firstBody);
        replay.Headers.GetValues("Idempotent-Replayed").ShouldBe(["true"]);
        replay.Headers.Location.ShouldBe(first.Headers.Location);
        (await PostOrderAsync(body with { Comment = "changed" }, key, owner)).StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        (await api.WithDbAsync(db => db.Set<Order>().CountAsync(o => o.IdempotencyKey == key, Ct))).ShouldBe(1);

        var guestKey = Guid.NewGuid().ToString();
        (await PostOrderAsync(body, guestKey)).StatusCode.ShouldBe(HttpStatusCode.Created);
        (await PostOrderAsync(body, guestKey, owner)).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        // Existing pre-upgrade rows cannot establish the original subject. Do not return their token or create another order.
        await api.WithDbAsync(db => db.IdempotencyRecords.Where(r => r.Key == guestKey)
            .ExecuteUpdateAsync(s => s.SetProperty(r => r.SubjectHash, (string?)null), Ct));
        (await PostOrderAsync(body, guestKey)).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await api.WithDbAsync(db => db.Set<Order>().CountAsync(o => o.IdempotencyKey == guestKey, Ct))).ShouldBe(1);
        await api.WithDbAsync(db => db.IdempotencyRecords.Where(r => r.Key == key).ExecuteDeleteAsync(Ct));
        var expired = await PostOrderAsync(body, key, owner);
        expired.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await expired.Content.ReadFromJsonAsync<ProblemBody>(Ct))!.Code.ShouldBe("idempotency.result_expired");
        (await api.WithDbAsync(db => db.Set<Order>().CountAsync(o => o.IdempotencyKey == key, Ct))).ShouldBe(1);
    }

    [Fact]
    public async Task Warehouse_from_another_settlement_and_missing_offer_consent_are_validation_errors()
    {
        var product = await api.AddProductAsync("hospodarchi-tovary", "Товар для валідації", 50m);
        var body = Order(product.Id, 1, "50.00", UniquePhone()) with
        {
            Delivery = new DeliveryRequest(DeliveryCodes.NovaPoshta, "demo-bucha", "demo-lviv-b1"),
            AcceptOffer = false,
        };

        var response = await PostOrderAsync(body, Guid.NewGuid().ToString());

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await response.Content.ReadFromJsonAsync<ProblemBody>(Ct);
        problem!.Code.ShouldBe("validation.failed");
        problem.Errors!.Keys.ShouldBe(["delivery.warehouseRef", "acceptOffer"], ignoreOrder: true);
    }

    [Fact]
    public async Task Delivery_directory_finds_settlements_and_warehouses()
    {
        var settlements = await _client.GetFromJsonAsync<List<SettlementDto>>("/api/v1/delivery/np/settlements?q=буч", TestJson.Options, Ct);
        var bucha = settlements!.ShouldHaveSingleItem();
        bucha.Name.ShouldBe("Буча");

        var warehouses = await _client.GetFromJsonAsync<List<WarehouseDto>>(
            $"/api/v1/delivery/np/warehouses?settlementRef={bucha.Ref}",
            TestJson.Options,
            Ct);
        warehouses!.ShouldContain(w => w.Type == WarehouseType.Postomat);

        var unknown = await _client.GetAsync("/api/v1/delivery/np/warehouses?settlementRef=nowhere", Ct);
        unknown.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await unknown.Content.ReadFromJsonAsync<ProblemBody>(Ct))!.Code.ShouldBe("delivery.settlement_not_found");

        (await _client.GetFromJsonAsync<List<PickupPointDto>>("/api/v1/delivery/pickup-points", TestJson.Options, Ct))!
            .ShouldHaveSingleItem().Name.ShouldBe("Магазин Poli Valko");
    }

    [Fact]
    public async Task Too_many_orders_from_one_address_are_rejected_with_retry_after()
    {
        await using var limited = api.WithWebHostBuilder(builder => builder.UseSetting("RateLimiting:Orders:PermitLimit", "2"));
        var client = limited.CreateClient();
        var product = await api.AddProductAsync("hospodarchi-tovary", "Товар для ліміту замовлень", 50m);
        var body = Order(product.Id, 1, "50.00", UniquePhone()) with { AcceptOffer = false };

        (await PostOrderAsync(body, Guid.NewGuid().ToString(), client)).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await PostOrderAsync(body, Guid.NewGuid().ToString(), client)).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var rejected = await PostOrderAsync(body, Guid.NewGuid().ToString(), client);

        rejected.StatusCode.ShouldBe(HttpStatusCode.TooManyRequests);
        rejected.Headers.RetryAfter!.Delta!.Value.ShouldBeGreaterThan(TimeSpan.Zero);
        (await rejected.Content.ReadFromJsonAsync<ProblemBody>(Ct))!.Code.ShouldBe("http.too_many_requests");
    }

    internal Task<HttpResponseMessage> PostOrderAsync(CreateOrderRequest body, string key, HttpClient? client = null)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/v1/orders") { Content = JsonContent.Create(body, options: TestJson.Options) };
        request.Headers.Add("Idempotency-Key", key);
        return (client ?? _client).SendAsync(request, Ct);
    }

    internal static CreateOrderRequest Order(Guid productId, int quantity, string expectedTotal, string phone) => new(
        [new CartLineRequest(productId, quantity)],
        expectedTotal,
        new CustomerRequest("Олена Тестова", phone, Accounts.UniqueEmail("guest")),
        new DeliveryRequest(DeliveryCodes.NovaPoshta, "demo-bucha", "demo-bucha-b1"),
        new PaymentRequest(PaymentCodes.CashOnDelivery),
        null,
        AcceptOffer: true);

    internal static string UniquePhone() => $"+38067{Random.Shared.Next(1_000_000, 9_999_999)}";

    private sealed record PriceChangedProblem(string? Code, MoneyDto? Total);
}

using System.Net;
using System.Net.Http.Json;
using PoliValko.Api;
using PoliValko.Identity;
using PoliValko.Ordering.Api;
using PoliValko.Ordering.Domain;
using PoliValko.SharedKernel;

namespace PoliValko.IntegrationTests;

public sealed class AdminApiTests(ApiFactory api)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Admin_endpoints_require_login()
    {
        var response = await api.CreateClient().GetAsync("/api/v1/admin/orders", Ct);

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        response.Content.Headers.ContentType!.MediaType.ShouldBe("application/problem+json");
        (await response.Content.ReadFromJsonAsync<ProblemBody>(Ct))!.Code.ShouldBe("auth.unauthorized");
    }

    [Fact]
    public async Task Wrong_password_is_rejected()
    {
        var response = await api.CreateClient().PostAsJsonAsync(
            "/api/v1/admin/auth/login",
            new LoginRequest(ApiFactory.ManagerEmail, "not-the-password"),
            Ct);

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        (await response.Content.ReadFromJsonAsync<ProblemBody>(Ct))!.Code.ShouldBe("auth.invalid_credentials");
    }

    [Fact]
    public async Task Manager_cannot_list_users()
    {
        var manager = await LoginAsync(ApiFactory.ManagerEmail);

        var me = await manager.GetFromJsonAsync<StaffMeDto>("/api/v1/admin/auth/me", Ct);
        me!.Roles.ShouldBe(["Manager"]);

        var response = await manager.GetAsync("/api/v1/admin/users", Ct);
        response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await response.Content.ReadFromJsonAsync<ProblemBody>(Ct))!.Code.ShouldBe("auth.forbidden");
    }

    [Fact]
    public async Task Status_change_requires_csrf_follows_transitions_and_records_who_changed_it()
    {
        var product = await api.AddProductAsync("ruchnyi-instrument", "Лопата для адмінки", 1549m, stock: 4);
        var checkout = new CheckoutApiTests(api);
        var phone = CheckoutApiTests.UniquePhone();
        var created = (await (await checkout.PostOrderAsync(CheckoutApiTests.Order(product.Id, 1, "1549.00", phone), Guid.NewGuid().ToString()))
            .Content.ReadFromJsonAsync<OrderCreatedDto>(TestJson.Options, Ct))!;
        var admin = await LoginAsync(ApiFactory.AdminEmail);

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
        var manager = await LoginAsync(ApiFactory.ManagerEmail);

        // camelCase, як у JSON і OpenAPI (саме так шле типізований клієнт адмінки), і будь-який регістр.
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

    private async Task<HttpClient> LoginAsync(string email)
    {
        var client = api.CreateClient();
        var response = await client.PostAsJsonAsync("/api/v1/admin/auth/login", new LoginRequest(email, ApiFactory.TestPassword), Ct);
        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        return client;
    }
}

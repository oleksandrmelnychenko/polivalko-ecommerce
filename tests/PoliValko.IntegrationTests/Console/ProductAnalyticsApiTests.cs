using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;
using PoliValko.Console.Features.Analytics;
using PoliValko.Identity.Features.Auth;
using PoliValko.Infrastructure.Security.Permissions;
using PoliValko.Ordering.Contracts;
using PoliValko.Ordering.Domain;
using PoliValko.SharedKernel;

namespace PoliValko.IntegrationTests;

public sealed class ProductAnalyticsApiTests(ApiFactory api)
{
    private const string Url = "/api/v1/console/product-analytics";
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Theory]
    [InlineData("stock-turnover")]
    [InlineData("customer-recommendations")]
    [InlineData("recommendation-results")]
    public async Task Reports_with_stock_require_catalog_read_access_in_addition_to_document_analytics(string analysis)
    {
        using var admin = await Staff.AdminAsync(api);
        using var reader = await TestRoles.LoginWithPermissionsAsync(api, admin, PermissionKeys.ProductAnalyticsView, PermissionKeys.AccountingView);
        using var response = await reader.GetAsync($"/api/v1/console/business-analytics/documents?analysis={analysis}&days=30", Ct);
        response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Analytics_without_a_service_reports_unavailable_while_the_console_stays_available()
    {
        await using var host = api.WithWebHostBuilder(builder => builder.UseSetting("ProductAnalytics:BaseUrl", string.Empty));
        using var client = host.CreateClient();
        using var login = await client.PostAsJsonAsync("/api/v1/console/auth/login",
            new LoginRequest(ApiFactory.AdminEmail, ApiFactory.TestPassword), Ct);
        login.StatusCode.ShouldBe(HttpStatusCode.OK);

        using var response = await client.GetAsync(Url, Ct);
        response.StatusCode.ShouldBe(HttpStatusCode.ServiceUnavailable);
        (await response.ProblemCodeAsync()).ShouldBe("analytics.unavailable");
        (await client.GetAsync("/api/v1/console/summary", Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Only_authorized_staff_see_product_sales_and_itemized_returns()
    {
        using var guest = api.CreateClient();
        using var manager = await Staff.ManagerAsync(api);
        using var admin = await Staff.AdminAsync(api);
        using var analyst = await TestRoles.LoginWithPermissionsAsync(api, admin, PermissionKeys.ProductAnalyticsView);
        (await guest.GetAsync(Url, Ct)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        (await manager.GetAsync(Url, Ct)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        var invalid = await analyst.GetAsync($"{Url}?days=5&source=all", Ct);
        invalid.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await invalid.Content.ReadFromJsonAsync<ProblemBody>(Ct))!.Errors!.Keys.ShouldBe(["source", "days"], ignoreOrder: true);

        const decimal unitPrice = 120.35m;
        var product = await api.AddProductAsync("ruchnyi-instrument", "Товар для аналітики", unitPrice, stock: 10);
        var order = await TestOrders.PlaceAsync(api, product.Id, 3, unitPrice, CheckoutApiTests.UniquePhone());
        var day = new DateOnly(2019, 7, 1);
        await api.WithDbAsync(async db =>
        {
            var date = KyivTime.StartOfDay(day);
            await db.Set<Order>().Where(value => value.Number == order.Number)
                .ExecuteUpdateAsync(update => update.SetProperty(value => value.Status, OrderStatus.Completed)
                    .SetProperty(value => value.CreatedAt, date), Ct);
            var item = await db.Set<OrderItem>().SingleAsync(value => value.ProductId == product.Id, Ct);
            var refundId = Guid.NewGuid();
            db.Add(new OrderRefund
            {
                Id = refundId, OrderId = item.OrderId, Method = RefundMethod.Manual, Status = RefundStatus.Succeeded, Amount = item.UnitPrice,
                Reason = "Тестове повернення", RequestedBy = "Тест", CreatedAt = date.AddDays(1), CompletedAt = date.AddDays(1),
                Lines = [new OrderRefundLine { Id = Guid.NewGuid(), RefundId = refundId, OrderItemId = item.Id, Quantity = 1, Amount = item.UnitPrice }],
            });
            return await db.SaveChangesAsync(Ct);
        });

        var report = await analyst.ReadAsync<ProductAnalyticsDto>($"{Url}?days=30&end=2019-07-02&product={product.Id}");
        report.Source.ShouldBe("web");
        report.Inventory.HealthyProducts.ShouldBeGreaterThan(0);
        report.Inventory.LowStockThreshold.ShouldBe(3m);
        report.Metrics.GrossRevenue.ShouldBe(361.05m);
        report.Metrics.ReturnValue.ShouldBe(120.35m);
        report.Metrics.NetRevenue.ShouldBe(240.70m);
        report.Metrics.PreviousNetRevenue.ShouldBeNull();
        report.Trend.Select(value => value.SoldUnits).ShouldBe([3m, 0m]);
        report.Trend.Select(value => value.ReturnedUnits).ShouldBe([0m, 1m]);
        var selected = report.SelectedProduct.ShouldNotBeNull();
        selected.CatalogProductId.ShouldBe(product.Id);
        selected.StockDays.ShouldBeNull();
    }
}

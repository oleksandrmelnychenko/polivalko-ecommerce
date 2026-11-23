using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using Microsoft.Extensions.DependencyInjection;
using PoliValko.Catalog.Contracts;
using PoliValko.Catalog.Features.Console.Products;
using PoliValko.Console.Features.Dashboard;
using PoliValko.Ordering.Contracts;
using PoliValko.Ordering.Features.Console.Orders;
using PoliValko.SharedKernel;

namespace PoliValko.IntegrationTests;

public sealed class ConsoleDashboardApiTests(ApiFactory api)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private static DateOnly KyivToday => KyivTime.Today(TimeProvider.System);

    [Fact]
    public async Task Dashboard_shows_every_kyiv_day_and_counts_a_new_order()
    {
        var manager = await Staff.ManagerAsync(api);
        var before = await manager.ReadAsync<ConsoleDashboardDto>("/api/v1/console/dashboard");
        var product = await api.AddProductAsync("ruchnyi-instrument", "Мотика для зведення", 731m, stock: 5);

        await TestOrders.PlaceAsync(api, product.Id, 2, 731m, CheckoutApiTests.UniquePhone());

        var after = await manager.ReadAsync<ConsoleDashboardDto>("/api/v1/console/dashboard");
        after.Days.ShouldBe(30);
        after.ByDay.Count.ShouldBe(30);
        after.ByDay[^1].Date.ShouldBe(KyivToday);
        after.ByDay[0].Date.ShouldBe(KyivToday.AddDays(-29));
        after.Current.Orders.ShouldBe(before.Current.Orders + 1);
        Amount(after.Current.Revenue).ShouldBe(Amount(before.Current.Revenue) + 1462m);
        after.ByDay.Sum(d => d.Orders).ShouldBe(after.Current.Orders);
        after.ByStatus.Sum(s => s.Count).ShouldBe(after.Current.Orders + after.Current.Cancelled);
        after.ByStatus.ShouldContain(s => s.Status == OrderStatus.New);
        after.ByStatus.Select(s => s.Status).ShouldBeInOrder();
        after.ByDelivery.ShouldContain(d => d.Method == DeliveryCodes.NovaPoshta);
        after.TopProducts.Count.ShouldBeLessThanOrEqualTo(5);
        after.LowStock.Count.ShouldBeLessThanOrEqualTo(8);
        after.LowStock.ShouldAllBe(p => p.Stock <= 3);

        var week = await manager.ReadAsync<ConsoleDashboardDto>("/api/v1/console/dashboard?days=7");
        week.ByDay.Count.ShouldBe(7);
        week.ByDay[^1].Date.ShouldBe(KyivToday);

        var invalid = await manager.GetAsync("/api/v1/console/dashboard?days=5", Ct);
        invalid.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await invalid.Content.ReadFromJsonAsync<ProblemBody>(Ct))!.Errors!.ShouldContainKey("days");
    }

    [Fact]
    public async Task Cancelled_orders_are_reported_apart_from_orders_buyers_and_deliveries()
    {
        var manager = await Staff.ManagerAsync(api);
        var admin = await Staff.AdminAsync(api);
        var before = await manager.ReadAsync<ConsoleDashboardDto>("/api/v1/console/dashboard");
        var product = await api.AddProductAsync("ruchnyi-instrument", "Сапа для скасування", 500m, stock: 9);
        await TestOrders.PlaceAsync(api, product.Id, 2, 500m, CheckoutApiTests.UniquePhone());
        var dropped = await TestOrders.PlaceAsync(api, product.Id, 1, 500m, CheckoutApiTests.UniquePhone());
        (await admin.PostAsJsonAsync($"/api/v1/console/orders/{dropped.Number}/status", new { status = "cancelled" }, Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);

        var after = await manager.ReadAsync<ConsoleDashboardDto>("/api/v1/console/dashboard");
        after.Current.Orders.ShouldBe(before.Current.Orders + 1);
        after.Current.Cancelled.ShouldBe(before.Current.Cancelled + 1);
        after.Current.Customers.ShouldBe(before.Current.Customers + 1);
        Amount(after.Current.Revenue).ShouldBe(Amount(before.Current.Revenue) + 1000m);
        after.ByDay.Sum(d => d.Orders).ShouldBe(after.Current.Orders);
        after.ByDelivery.Sum(d => d.Count).ShouldBe(after.Current.Orders);
        after.ByStatus.Sum(s => s.Count).ShouldBe(after.Current.Orders + after.Current.Cancelled);
        Amount(after.Current.AverageOrder).ShouldBe(Math.Round(Amount(after.Current.Revenue) / after.Current.Orders, 2, MidpointRounding.AwayFromZero));
    }

    [Fact]
    public async Task Top_products_show_sales_after_itemized_refunds()
    {
        var manager = await Staff.ManagerAsync(api);
        var admin = await Staff.AdminAsync(api);
        var kept = await api.AddProductAsync("ruchnyi-instrument", "Мотоблок для рейтингу", 49000m, stock: 9);
        var returned = await api.AddProductAsync("ruchnyi-instrument", "Мотоблок повернений", 48000m, stock: 9);
        var first = await TestOrders.PlaceAsync(api, kept.Id, 3, 49000m, CheckoutApiTests.UniquePhone());
        var second = await TestOrders.PlaceAsync(api, returned.Id, 1, 48000m, CheckoutApiTests.UniquePhone());
        foreach (var number in new[] { first.Number, second.Number })
        {
            foreach (var status in new[] { "confirmed", "shipped", "completed" })
            {
                (await admin.PostAsJsonAsync($"/api/v1/console/orders/{number}/status", new { status }, Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
            }
        }

        await (await admin.PostWithKeyAsync($"/api/v1/console/orders/{first.Number}/refunds",
            new CreateRefundRequest([new RefundLineRequest(kept.Id, 2)], "Повернули два з трьох"))).ReadAsync<ConsoleOrderDto>();
        await (await admin.PostWithKeyAsync($"/api/v1/console/orders/{second.Number}/refunds",
            new CreateRefundRequest([new RefundLineRequest(returned.Id, 1)], "Повернули єдиний"))).ReadAsync<ConsoleOrderDto>();

        // The card shows five products, and other tests sell in the same period: read the whole ranking it is cut from.
        var top = await api.WithScopeAsync(services => services.GetRequiredService<IOrderReporting>().TopProductsAsync(
            KyivTime.StartOfDay(KyivToday.AddDays(-1)), KyivTime.StartOfDay(KyivToday.AddDays(1)), int.MaxValue, Ct));
        var row = top.Single(p => p.ProductId == kept.Id);
        row.Quantity.ShouldBe(1);
        row.Revenue.ShouldBe(49000m);
        top.ShouldNotContain(p => p.ProductId == returned.Id);
        top.Select(p => p.Revenue).ShouldBeInOrder(SortDirection.Descending);
        (await manager.ReadAsync<ConsoleDashboardDto>("/api/v1/console/dashboard")).TopProducts.ShouldNotContain(p => p.ProductId == returned.Id);
    }

    [Fact]
    public async Task Low_stock_lists_visible_products_with_a_few_units_left_after_reservations()
    {
        var manager = await Staff.ManagerAsync(api);
        var few = await api.AddProductAsync("hospodarchi-tovary", "Лійка, остання", 120m, stock: 1);
        var soldOut = await api.AddProductAsync("hospodarchi-tovary", "Лійка розпродана", 120m, stock: 0);
        var reserved = await api.AddProductAsync("hospodarchi-tovary", "Лійка в резерві", 120m, stock: 5);
        await TestOrders.PlaceAsync(api, reserved.Id, 4, 120m, CheckoutApiTests.UniquePhone());

        // The card shows eight products, and other tests leave low stock too: read the whole list it is cut from.
        var low = await api.WithScopeAsync(services => services.GetRequiredService<ICatalogReporting>().GetLowStockAsync(int.MaxValue, Ct));
        low.ShouldAllBe(p => p.Stock > 0 && p.Stock <= 3);
        low.Single(p => p.Id == few.Id).Stock.ShouldBe(1);
        low.Single(p => p.Id == reserved.Id).Stock.ShouldBe(1);
        low.ShouldNotContain(p => p.Id == soldOut.Id);
        low.Select(p => p.Stock).ShouldBeInOrder();
        (await manager.ReadAsync<ConsoleDashboardDto>("/api/v1/console/dashboard")).LowStock.ShouldAllBe(p => p.Stock > 0 && p.Stock <= 3);

        (await ListProductsAsync(manager, reserved.Sku, "low")).ShouldHaveSingleItem().Id.ShouldBe(reserved.Id);
        (await ListProductsAsync(manager, reserved.Sku, "in")).ShouldHaveSingleItem();
        (await ListProductsAsync(manager, soldOut.Sku, "out")).ShouldHaveSingleItem().Id.ShouldBe(soldOut.Id);
        (await ListProductsAsync(manager, soldOut.Sku, "low")).ShouldBeEmpty();
    }

    private static async Task<IReadOnlyList<ConsoleProductListItemDto>> ListProductsAsync(HttpClient client, string sku, string stock) =>
        (await client.ReadAsync<PagedResponse<ConsoleProductListItemDto>>($"/api/v1/console/catalog/products?q={sku}&stock={stock}&visible=true")).Items;

    private static decimal Amount(MoneyDto money) => decimal.Parse(money.Value, CultureInfo.InvariantCulture);
}

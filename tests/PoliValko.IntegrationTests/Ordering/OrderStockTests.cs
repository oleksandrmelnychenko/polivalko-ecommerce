using System.Net;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Domain;
using PoliValko.Ordering.Contracts;
using PoliValko.Ordering.Features.Console.Orders;

namespace PoliValko.IntegrationTests;

// The console is where stock is kept: no ERP confirms a shipment any more, so the shop writes the goods off itself.
public sealed class OrderStockTests(ApiFactory api)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task A_shipped_order_takes_its_goods_off_the_stock_and_frees_the_reserve()
    {
        var product = await api.AddProductAsync("vse-dlia-polyvu", "Лійка для списання", 100m, stock: 10);
        var order = await TestOrders.PlaceAsync(api, product.Id, 3, 100m, CheckoutApiTests.UniquePhone());
        (await StockAsync(product.Id)).ShouldBe((10m, 3m));

        await MoveAsync(order.Number, OrderStatus.Confirmed, OrderStatus.Shipped);
        (await StockAsync(product.Id)).ShouldBe((7m, 0m));

        // Completing it later changes nothing more.
        await MoveAsync(order.Number, OrderStatus.Completed);
        (await StockAsync(product.Id)).ShouldBe((7m, 0m));
    }

    [Fact]
    public async Task Cancelling_a_shipped_order_leaves_no_reserve_behind()
    {
        var product = await api.AddProductAsync("vse-dlia-polyvu", "Шланг для скасування", 100m, stock: 10);
        var order = await TestOrders.PlaceAsync(api, product.Id, 2, 100m, CheckoutApiTests.UniquePhone());

        await MoveAsync(order.Number, OrderStatus.Confirmed, OrderStatus.Shipped, OrderStatus.Cancelled);

        // The parcel left the shop: a return comes back through a stock correction, but nothing stays reserved for ever.
        (await StockAsync(product.Id)).ShouldBe((8m, 0m));
    }

    [Fact]
    public async Task A_write_off_never_takes_the_stock_below_zero_after_a_manual_correction()
    {
        var product = await api.AddProductAsync("vse-dlia-polyvu", "Лійка після інвентаризації", 100m, stock: 10);
        var order = await TestOrders.PlaceAsync(api, product.Id, 3, 100m, CheckoutApiTests.UniquePhone());
        // A count in the shop found only one left while the order waited.
        await api.WithDbAsync(db => db.Set<ProductStock>().Where(s => s.ProductId == product.Id)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.Quantity, 1m), Ct));

        await MoveAsync(order.Number, OrderStatus.Confirmed, OrderStatus.Shipped);

        (await StockAsync(product.Id)).ShouldBe((0m, 0m));
    }

    private async Task MoveAsync(string number, params OrderStatus[] statuses)
    {
        using var admin = await Staff.AdminAsync(api);
        foreach (var status in statuses)
            (await admin.PostJsonAsync($"/api/v1/console/orders/{number}/status", new ChangeOrderStatusRequest(status, "Тест")))
                .StatusCode.ShouldBe(HttpStatusCode.OK, status.ToString());
    }

    private Task<(decimal Quantity, decimal Reserved)> StockAsync(Guid productId) => api.WithDbAsync(async db =>
    {
        var stock = await db.Set<ProductStock>().AsNoTracking().SingleAsync(s => s.ProductId == productId, Ct);
        return (stock.Quantity, stock.ReservedQuantity);
    });
}

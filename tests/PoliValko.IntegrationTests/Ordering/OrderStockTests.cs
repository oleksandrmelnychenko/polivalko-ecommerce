using System.Net;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PoliValko.Catalog.Contracts;
using PoliValko.Catalog.Domain;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Ordering.Contracts;
using PoliValko.Ordering.Domain;
using PoliValko.Ordering.Features.Checkout;
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
    public async Task Cancelling_a_shipped_order_restores_stock_once_and_leaves_no_reserve_behind()
    {
        var product = await api.AddProductAsync("vse-dlia-polyvu", "Шланг для скасування", 100m, stock: 10);
        var order = await TestOrders.PlaceAsync(api, product.Id, 2, 100m, CheckoutApiTests.UniquePhone());

        await MoveAsync(order.Number, OrderStatus.Confirmed, OrderStatus.Shipped);
        (await StockAsync(product.Id)).ShouldBe((8m, 0m));

        await MoveAsync(order.Number, OrderStatus.Cancelled);
        (await StockAsync(product.Id)).ShouldBe((10m, 0m));

        // Guard against double-restock: calling RestockAsync again must be a no-op.
        var orderId = await OrderIdAsync(order.Number);
        await api.WithScopeAsync(async sp =>
        {
            await using var tx = await sp.GetRequiredService<PoliValkoDbContext>().Database.BeginTransactionAsync(Ct);
            await sp.GetRequiredService<ICatalogReservations>().RestockAsync(orderId, Ct);
            await tx.CommitAsync(Ct);
            return 0;
        });
        (await StockAsync(product.Id)).ShouldBe((10m, 0m));
    }

    [Fact]
    public async Task Partial_refund_before_shipment_reduces_reservation_so_shipment_deducts_only_remaining()
    {
        var product = await api.AddProductAsync("vse-dlia-polyvu", "Фітинг часткового повернення", 100m, stock: 10);
        var body = CheckoutApiTests.Order(product.Id, 3, "300.00", CheckoutApiTests.UniquePhone()) with
        {
            Payment = new PaymentRequest(PaymentCodes.Card),
        };
        var created = await (await new CheckoutApiTests(api).PostOrderAsync(body, Guid.NewGuid().ToString()))
            .ReadAsync<OrderCreatedDto>(HttpStatusCode.Created);
        await api.WithDbAsync(async db =>
        {
            var entity = await db.Set<Order>().SingleAsync(o => o.Number == created.Number, Ct);
            entity.MarkPaid(DateTimeOffset.UtcNow, "Тест");
            return await db.SaveChangesAsync(Ct);
        });
        (await StockAsync(product.Id)).ShouldBe((10m, 3m));

        using var admin = await Staff.AdminAsync(api);
        await (await admin.PostWithKeyAsync(
                $"/api/v1/console/orders/{created.Number}/refunds",
                new CreateRefundRequest([new RefundLineRequest(product.Id, 1)], "Зменшили кількість до відправки")))
            .ReadAsync<ConsoleOrderDto>();

        (await StockAsync(product.Id)).ShouldBe((10m, 2m));

        await MoveAsync(created.Number, OrderStatus.Shipped);
        (await StockAsync(product.Id)).ShouldBe((8m, 0m));
    }

    [Fact]
    public async Task Refund_after_shipment_restores_stock_only_when_return_to_stock_is_true_without_double_restock()
    {
        var product = await api.AddProductAsync("vse-dlia-polyvu", "Обприскувач повернення", 100m, stock: 10);
        var order = await TestOrders.PlaceAsync(api, product.Id, 3, 100m, CheckoutApiTests.UniquePhone());
        await MoveAsync(order.Number, OrderStatus.Confirmed, OrderStatus.Shipped, OrderStatus.Completed);
        (await StockAsync(product.Id)).ShouldBe((7m, 0m));

        using var admin = await Staff.AdminAsync(api);
        await (await admin.PostWithKeyAsync(
                $"/api/v1/console/orders/{order.Number}/refunds",
                new CreateRefundRequest([new RefundLineRequest(product.Id, 1)], "Повернули неушкоджений", ReturnToStock: true)))
            .ReadAsync<ConsoleOrderDto>();
        (await StockAsync(product.Id)).ShouldBe((8m, 0m));

        await (await admin.PostWithKeyAsync(
                $"/api/v1/console/orders/{order.Number}/refunds",
                new CreateRefundRequest([new RefundLineRequest(product.Id, 1)], "Брак, не повертати", ReturnToStock: false)))
            .ReadAsync<ConsoleOrderDto>();
        (await StockAsync(product.Id)).ShouldBe((8m, 0m));

        await (await admin.PostWithKeyAsync(
                $"/api/v1/console/orders/{order.Number}/refunds",
                new CreateRefundRequest([new RefundLineRequest(product.Id, 1)], "Повернули останній", ReturnToStock: true)))
            .ReadAsync<ConsoleOrderDto>();
        (await StockAsync(product.Id)).ShouldBe((9m, 0m));
    }

    [Fact]
    public async Task Warehouse_shortage_on_shipment_returns_409_and_shipped_cancel_restores_warehouse_stock()
    {
        var product = await api.AddProductAsync("vse-dlia-polyvu", "Товар зі складу для відвантаження", 100m, stock: 5);
        var orgId = Guid.NewGuid();
        var storeId = Guid.NewGuid();
        var account = $"stock-test-{Guid.NewGuid():N}";
        await api.WithDbAsync(async db =>
        {
            await db.Database.ExecuteSqlAsync($"""
                INSERT INTO accounting.references(id, source_account, kind, source_id, title)
                VALUES ({orgId}, {account}, 'organization', 'org-1', 'Тестовий ФОП'),
                       ({storeId}, {account}, 'store', 'store-1', 'Тестовий склад');
                INSERT INTO accounting.warehouse_stock(org_id, store_id, product_id, quantity)
                VALUES ({orgId}, {storeId}, {product.Id}, 5);
                """, Ct);
            return 0;
        });

        await api.WithScopeAsync(async sp =>
        {
            var result = await sp.GetRequiredService<ICatalogWarehouseSource>()
                .ConnectBulkAsync(orgId, storeId, overwriteExisting: false, Ct);
            result.Connected.ShouldBe(1);
            return 0;
        });

        var order = await TestOrders.PlaceAsync(api, product.Id, 2, 100m, CheckoutApiTests.UniquePhone());
        await MoveAsync(order.Number, OrderStatus.Confirmed);

        // Simulate warehouse stock dropping below required shipment quantity.
        await api.WithDbAsync(db => db.Database.ExecuteSqlAsync($"""
            UPDATE accounting.warehouse_stock SET quantity = 1
            WHERE org_id = {orgId} AND store_id = {storeId} AND product_id = {product.Id}
            """, Ct));

        using var admin = await Staff.AdminAsync(api);
        var shortage = await admin.PostJsonAsync($"/api/v1/console/orders/{order.Number}/status", new ChangeOrderStatusRequest(OrderStatus.Shipped, "Відправка"));
        shortage.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await shortage.ProblemCodeAsync()).ShouldBe("ordering.stock_shortage");

        // Restore warehouse stock to 5, ship, then cancel -> both warehouse and catalog stock must return to 5.
        await api.WithDbAsync(db => db.Database.ExecuteSqlAsync($"""
            UPDATE accounting.warehouse_stock SET quantity = 5
            WHERE org_id = {orgId} AND store_id = {storeId} AND product_id = {product.Id}
            """, Ct));
        await MoveAsync(order.Number, OrderStatus.Shipped);
        (await StockAsync(product.Id)).ShouldBe((3m, 0m));

        await MoveAsync(order.Number, OrderStatus.Cancelled);
        (await StockAsync(product.Id)).ShouldBe((5m, 0m));
        var warehouseQty = await api.WithDbAsync(db => db.Database.SqlQuery<decimal>($"""
            SELECT quantity AS "Value" FROM accounting.warehouse_stock
            WHERE org_id = {orgId} AND store_id = {storeId} AND product_id = {product.Id}
            """).SingleAsync(Ct));
        warehouseQty.ShouldBe(5m);
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

    private Task<Guid> OrderIdAsync(string number) =>
        api.WithDbAsync(db => db.Set<Order>().AsNoTracking().Where(o => o.Number == number).Select(o => o.Id).SingleAsync(Ct));

    private Task<(decimal Quantity, decimal Reserved)> StockAsync(Guid productId) => api.WithDbAsync(async db =>
    {
        var stock = await db.Set<ProductStock>().AsNoTracking().SingleAsync(s => s.ProductId == productId, Ct);
        return (stock.Quantity, stock.ReservedQuantity);
    });
}

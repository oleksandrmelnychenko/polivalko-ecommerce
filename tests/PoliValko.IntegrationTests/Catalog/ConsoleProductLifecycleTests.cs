using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PoliValko.Catalog.Contracts;
using PoliValko.Catalog.Features.Console.Categories;
using PoliValko.Catalog.Features.Console.Products;
using PoliValko.Ordering.Contracts;
using PoliValko.Ordering.Features.Console.Orders;
using PoliValko.SharedKernel;

namespace PoliValko.IntegrationTests;

public sealed class ConsoleProductLifecycleTests(ApiFactory api)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Created_product_can_be_archived_and_restored_without_changing_identity()
    {
        const string path = "/api/v1/console/catalog/products";
        var admin = await Staff.AdminAsync(api);
        var category = (await admin.ReadAsync<List<ConsoleCategoryDto>>("/api/v1/console/catalog/categories")).First();
        var sku = $"qa-{Guid.NewGuid():N}";
        var input = new CreateCatalogProductRequest("Ручний товар", sku, category.Id);
        var id = await (await admin.PostAsJsonAsync(path, input, Ct)).ReadAsync<Guid>(HttpStatusCode.Created);
        (await admin.PostAsJsonAsync(path, input, Ct)).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var url = $"{path}/{id}";
        var visible = new SetProductsVisibilityRequest([id], true);
        (await admin.PostAsJsonAsync($"{path}/visibility", visible, Ct)).EnsureSuccessStatusCode();
        foreach (var archived in new[] { true, true, false })
        {
            (await admin.PutAsJsonAsync($"{url}/archive", new SetProductArchiveRequest(archived), Ct)).StatusCode.ShouldBe(HttpStatusCode.NoContent);
            var product = await admin.ReadAsync<ConsoleProductDto>(url);
            product.Id.ShouldBe(id);
            product.IsArchived.ShouldBe(archived);
            product.IsVisible.ShouldBeFalse();
            product.Navkolo.Sku.ShouldBe(sku);
            (await admin.ReadAsync<PagedResponse<ConsoleProductListItemDto>>($"{path}?q={sku}")).TotalItems.ShouldBe(archived ? 0 : 1);
            (await admin.ReadAsync<PagedResponse<ConsoleProductListItemDto>>($"{path}?q={sku}&archived=true")).TotalItems.ShouldBe(archived ? 1 : 0);
            if (archived) (await admin.PostAsJsonAsync($"{path}/visibility", visible, Ct)).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        }
    }

    [Fact]
    public async Task Archive_is_blocked_when_product_has_reserved_or_warehouse_stock_and_dtos_expose_warehouse_fields()
    {
        var admin = await Staff.AdminAsync(api);
        var reservedProduct = await api.AddProductAsync("ruchnyi-instrument", "Товар у резерві для архіву", 200m, stock: 5);
        var warehouseProduct = await api.AddProductAsync("ruchnyi-instrument", "Товар зі складу для архіву", 200m, stock: 5);
        var order = await TestOrders.PlaceAsync(api, reservedProduct.Id, 2, 200m, CheckoutApiTests.UniquePhone());

        var blockedReserve = await admin.PutAsJsonAsync($"/api/v1/console/catalog/products/{reservedProduct.Id}/archive", new SetProductArchiveRequest(true), Ct);
        blockedReserve.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await blockedReserve.ProblemCodeAsync()).ShouldBe("catalog.product_archive_blocked");

        var orgId = Guid.NewGuid();
        var storeId = Guid.NewGuid();
        var account = $"archive-test-{Guid.NewGuid():N}";
        await api.WithDbAsync(async db =>
        {
            await db.Database.ExecuteSqlAsync($"""
                INSERT INTO accounting.references(id, source_account, kind, source_id, title)
                VALUES ({orgId}, {account}, 'organization', 'org-arch', 'Архів ФОП'),
                       ({storeId}, {account}, 'store', 'store-arch', 'Основний склад');
                INSERT INTO accounting.warehouse_stock(org_id, store_id, product_id, quantity)
                VALUES ({orgId}, {storeId}, {reservedProduct.Id}, 7),
                       ({orgId}, {storeId}, {warehouseProduct.Id}, 4);
                """, Ct);
            return 0;
        });

        await api.WithScopeAsync(async sp =>
        {
            var bulk = await sp.GetRequiredService<ICatalogWarehouseSource>()
                .ConnectBulkAsync(orgId, storeId, overwriteExisting: false, Ct);
            bulk.Connected.ShouldBe(2);
            bulk.Skipped.ShouldBe(0);
            bulk.Conflicts.ShouldBeEmpty();
            return 0;
        });

        var listItem = (await admin.ReadAsync<PagedResponse<ConsoleProductListItemDto>>($"/api/v1/console/catalog/products?q={reservedProduct.Sku}")).Items.ShouldHaveSingleItem();
        listItem.Stock.ShouldBe(7m);
        listItem.ReservedQuantity.ShouldBe(2m);
        listItem.AvailableQuantity.ShouldBe(5m);
        listItem.WarehouseOrgId.ShouldBe(orgId);
        listItem.WarehouseStoreId.ShouldBe(storeId);
        listItem.WarehouseStoreTitle.ShouldBe("Основний склад");

        var detail = await admin.ReadAsync<ConsoleProductDto>($"/api/v1/console/catalog/products/{reservedProduct.Id}");
        detail.ReservedQuantity.ShouldBe(2m);
        detail.AvailableQuantity.ShouldBe(5m);
        detail.WarehouseOrgId.ShouldBe(orgId);
        detail.WarehouseStoreId.ShouldBe(storeId);
        detail.WarehouseStoreTitle.ShouldBe("Основний склад");

        var blockedWarehouse = await admin.PutAsJsonAsync($"/api/v1/console/catalog/products/{warehouseProduct.Id}/archive", new SetProductArchiveRequest(true), Ct);
        blockedWarehouse.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await blockedWarehouse.ProblemCodeAsync()).ShouldBe("catalog.product_archive_blocked");

        await api.WithScopeAsync(async sp =>
        {
            var sources = sp.GetRequiredService<ICatalogWarehouseSource>();
            var cannotDisconnect = await sources.DisconnectAsync(reservedProduct.Id, Ct);
            cannotDisconnect.Conflict.ShouldNotBeNull();

            var disconnected = await sources.DisconnectAsync(warehouseProduct.Id, Ct);
            disconnected.Conflict.ShouldBeNull();
            disconnected.ProductId.ShouldBe(warehouseProduct.Id);
            return 0;
        });

        var afterDisconnect = await admin.ReadAsync<ConsoleProductDto>($"/api/v1/console/catalog/products/{warehouseProduct.Id}");
        afterDisconnect.WarehouseOrgId.ShouldBeNull();
        afterDisconnect.WarehouseStoreId.ShouldBeNull();
        afterDisconnect.WarehouseStoreTitle.ShouldBeNull();

        // Cancel order to release reservation cleanly.
        (await admin.PostJsonAsync($"/api/v1/console/orders/{order.Number}/status", new ChangeOrderStatusRequest(OrderStatus.Cancelled, "Тест")))
            .StatusCode.ShouldBe(HttpStatusCode.OK);
    }
}

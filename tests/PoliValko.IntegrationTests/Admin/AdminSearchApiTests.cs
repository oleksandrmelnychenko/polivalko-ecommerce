using PoliValko.Admin.Features.Search;
using PoliValko.SharedKernel;

namespace PoliValko.IntegrationTests;

public sealed class AdminSearchApiTests(ApiFactory api)
{
    [Fact]
    public async Task Search_finds_orders_products_and_customers()
    {
        var phone = CheckoutApiTests.UniquePhone();
        var product = await api.AddProductAsync("ruchnyi-instrument", "Культиватор для пошуку", 1320m, stock: 5);
        var created = await TestOrders.PlaceAsync(api, product.Id, 1, 1320m, phone);
        var manager = await Staff.ManagerAsync(api);

        var byNumber = await manager.ReadAsync<AdminSearchDto>($"/api/v1/admin/search?q={created.Number.ToLowerInvariant()}");
        var hit = byNumber.Orders.ShouldHaveSingleItem();
        hit.Number.ShouldBe(created.Number);
        hit.Phone.ShouldBe(phone);
        hit.Total.ShouldBe(MoneyDto.Hryvnia(1320m));

        var bySku = await manager.ReadAsync<AdminSearchDto>($"/api/v1/admin/search?q={product.Sku.ToLowerInvariant()}");
        var found = bySku.Products.ShouldHaveSingleItem();
        found.Id.ShouldBe(product.Id);
        found.Price.ShouldBe(MoneyDto.Hryvnia(1320m));
        found.IsVisible.ShouldBeTrue();

        var byPhone = await manager.ReadAsync<AdminSearchDto>($"/api/v1/admin/search?q={Uri.EscapeDataString(phone)}");
        byPhone.Customers.ShouldHaveSingleItem().ShouldBe(new SearchCustomerHitDto(phone, "Олена Тестова", 1));

        var tooShort = await manager.ReadAsync<AdminSearchDto>("/api/v1/admin/search?q=%20P%20");
        tooShort.Orders.ShouldBeEmpty();
        tooShort.Products.ShouldBeEmpty();
        tooShort.Customers.ShouldBeEmpty();
    }
}

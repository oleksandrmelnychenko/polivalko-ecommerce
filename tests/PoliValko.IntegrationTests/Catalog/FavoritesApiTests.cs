using System.Net;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Domain;
using PoliValko.Catalog.Features.Storefront;
using PoliValko.SharedKernel;

namespace PoliValko.IntegrationTests;

public sealed class FavoritesApiTests(ApiFactory api)
{
    private const string Url = "/api/v1/account/favorites";

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Favorites_are_added_listed_and_removed_for_visible_products_only()
    {
        var can = await api.AddProductAsync("vse-dlia-polyvu", "Лійка в обраному", 300m);
        var hose = await api.AddProductAsync("vse-dlia-polyvu", "Шланг в обраному", 450m, oldPrice: 500m);
        var hidden = await api.AddProductAsync("vse-dlia-polyvu", "Прихований товар для обраного", 100m, visible: false);
        var (client, _) = await Accounts.RegisterAsync(api);

        (await client.PutAsync($"{Url}/{can.Id}", null, Ct)).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await client.PutAsync($"{Url}/{hose.Id}", null, Ct)).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await client.PutAsync($"{Url}/{can.Id}", null, Ct)).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        var hiddenResponse = await client.PutAsync($"{Url}/{hidden.Id}", null, Ct);
        hiddenResponse.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await hiddenResponse.ProblemCodeAsync()).ShouldBe("catalog.product_not_found");
        (await client.PutAsync($"{Url}/{Guid.NewGuid()}", null, Ct)).StatusCode.ShouldBe(HttpStatusCode.NotFound);

        (await client.ReadAsync<List<Guid>>($"{Url}/ids")).ShouldBe([hose.Id, can.Id]);
        var list = await client.ReadAsync<List<ProductListItemDto>>(Url);
        list.Select(p => p.Name).ShouldBe(["Шланг в обраному", "Лійка в обраному"]);
        list[0].Price.ShouldBe(new MoneyDto("450.00", "UAH"));
        list[0].OldPrice.ShouldBe(new MoneyDto("500.00", "UAH"));
        list[0].InStock.ShouldBeTrue();

        var (stranger, _) = await Accounts.RegisterAsync(api);
        (await stranger.ReadAsync<List<Guid>>($"{Url}/ids")).ShouldBeEmpty();

        await api.WithDbAsync(db => db.Set<Product>().Where(p => p.Id == hose.Id)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.IsVisible, false), Ct));
        (await client.ReadAsync<List<Guid>>($"{Url}/ids")).ShouldBe([can.Id]);
        (await client.ReadAsync<List<ProductListItemDto>>(Url)).Select(p => p.Id).ShouldBe([can.Id]);

        (await client.DeleteAsync($"{Url}/{can.Id}", Ct)).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await client.DeleteAsync($"{Url}/{can.Id}", Ct)).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await client.ReadAsync<List<Guid>>($"{Url}/ids")).ShouldBeEmpty();

        await api.WithDbAsync(db => db.Set<Product>().Where(p => p.Id == hose.Id)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.IsVisible, true), Ct));
        (await client.ReadAsync<List<Guid>>($"{Url}/ids")).ShouldBe([hose.Id]);
    }

    [Fact]
    public async Task Favorites_require_a_signed_in_customer()
    {
        var anonymous = await Accounts.AnonymousAsync(api);
        (await anonymous.GetAsync(Url, Ct)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        (await anonymous.GetAsync($"{Url}/ids", Ct)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        (await anonymous.PutAsync($"{Url}/{Guid.NewGuid()}", null, Ct)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }
}

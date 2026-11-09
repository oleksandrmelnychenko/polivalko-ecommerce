using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Domain;
using PoliValko.Catalog.Features.Storefront;

namespace PoliValko.IntegrationTests;

public sealed class PublicationSecurityTests(ApiFactory api)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Hidden_ancestor_removes_products_from_every_public_surface_and_checkout()
    {
        var suffix = Guid.NewGuid().ToString("N");
        var parent = new Category { Id = Guid.NewGuid(), Slug = "parent-" + suffix, Name = "Parent" };
        var child = new Category { Id = Guid.NewGuid(), ParentId = parent.Id, Slug = "child-" + suffix, Name = "Child" };
        var leaf = new Category { Id = Guid.NewGuid(), ParentId = child.Id, Slug = "leaf-" + suffix, Name = "Leaf" };
        await api.WithDbAsync(async db => { db.AddRange(parent, child, leaf); return await db.SaveChangesAsync(Ct); });
        var product = await api.AddProductAsync(leaf.Slug, "Visibility " + suffix, 100m);
        var collection = new HomeCollection { Id = Guid.NewGuid(), Code = suffix, Title = suffix, ProductIds = [product.Id] };
        await api.WithDbAsync(async db => { db.Add(collection); return await db.SaveChangesAsync(Ct); });
        var (client, _) = await Accounts.RegisterAsync(api);
        (await client.GetAsync($"/api/v1/products/{product.Slug}", Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await client.PutAsync($"/api/v1/account/favorites/{product.Id}", null, Ct)).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        await api.WithDbAsync(db => db.Set<Category>().Where(c => c.Id == parent.Id).ExecuteUpdateAsync(s => s.SetProperty(c => c.IsVisible, false), Ct));

        foreach (var path in new[] { $"products/{product.Slug}", $"categories/{leaf.Slug}", $"products?category={leaf.Slug}" })
            (await client.GetAsync("/api/v1/" + path, Ct)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await client.ReadAsync<ProductSearchResponse>($"/api/v1/products?q={suffix}")).Items.ShouldBeEmpty();
        (await client.GetStringAsync("/api/v1/catalog/sitemap", Ct)).ShouldNotContain(product.Slug);
        (await client.GetStringAsync("/api/v1/collections", Ct)).ShouldNotContain(product.Id.ToString());
        (await client.ReadAsync<List<Guid>>("/api/v1/account/favorites/ids")).ShouldBeEmpty();
        (await client.ReadAsync<List<ProductListItemDto>>("/api/v1/account/favorites")).ShouldBeEmpty();
        (await client.PutAsync($"/api/v1/account/favorites/{product.Id}", null, Ct)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        var order = await new CheckoutApiTests(api).PostOrderAsync(CheckoutApiTests.Order(product.Id, 1, "100.00", CheckoutApiTests.UniquePhone()), Guid.NewGuid().ToString(), client);
        order.IsSuccessStatusCode.ShouldBeFalse();

        await api.WithDbAsync(db => db.Set<Category>().Where(c => c.Id == parent.Id).ExecuteUpdateAsync(s => s.SetProperty(c => c.IsVisible, true), Ct));
        (await client.GetAsync($"/api/v1/products/{product.Slug}", Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await client.ReadAsync<List<Guid>>("/api/v1/account/favorites/ids")).ShouldContain(product.Id);
        // Do not leave extra visible roots in the shared fixture.
        await api.WithDbAsync(db => db.Set<Category>().Where(c => c.Id == parent.Id).ExecuteUpdateAsync(s => s.SetProperty(c => c.IsVisible, false), Ct));
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Local_unicode_redirects_resolve_for_new_and_legacy_records(bool legacy)
    {
        var from = "/старий-" + Guid.NewGuid().ToString("N");
        var to = "/catalog/vse-dlia-polyvu";
        if (legacy)
            await api.WithDbAsync(async db =>
            {
                db.Add(new UrlRedirect { Id = Guid.NewGuid(), FromPath = from, ToPath = to, CreatedAt = DateTimeOffset.UtcNow });
                return await db.SaveChangesAsync(Ct);
            });
        else
        {
            var admin = await Staff.AdminAsync(api);
            (await admin.PostAsJsonAsync("/api/v1/console/catalog/redirects", new { fromPath = from, toPath = to }, Ct)).StatusCode.ShouldBe(HttpStatusCode.Created);
        }
        var resolved = await api.CreateClient().ReadAsync<RedirectDto>("/api/v1/redirects/resolve?path=" + Uri.EscapeDataString(from));
        resolved.To.ShouldBe(to);
    }

    [Theory]
    [InlineData("/\\attacker.example")]
    [InlineData("/\t/attacker.example")]
    [InlineData("/\n/attacker.example")]
    [InlineData("//attacker.example")]
    [InlineData("/folder/..//attacker.example")]
    [InlineData("/%2e%2e//attacker.example")]
    public async Task External_redirects_are_rejected_on_write_and_existing_records_on_read(string destination)
    {
        var admin = await Staff.AdminAsync(api);
        var from = "/legacy-" + Guid.NewGuid().ToString("N");
        (await admin.PostAsJsonAsync("/api/v1/console/catalog/redirects", new { fromPath = from, toPath = destination }, Ct))
            .StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        await api.WithDbAsync(async db =>
        {
            db.Add(new UrlRedirect { Id = Guid.NewGuid(), FromPath = from, ToPath = destination, CreatedAt = DateTimeOffset.UtcNow });
            return await db.SaveChangesAsync(Ct);
        });
        (await api.CreateClient().GetAsync("/api/v1/redirects/resolve?path=" + Uri.EscapeDataString(from), Ct)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }
}

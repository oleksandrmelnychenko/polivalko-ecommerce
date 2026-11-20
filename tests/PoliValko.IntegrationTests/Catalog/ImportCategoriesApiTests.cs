using System.Net;
using System.Net.Http.Json;
using System.Text;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PoliValko.Catalog.Configuration;
using PoliValko.Catalog.Domain;
using PoliValko.Catalog.Features.Console.Categories;
using PoliValko.Catalog.Features.Storefront;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Security.Permissions;
using PoliValko.Infrastructure.Storefront;
using PoliValko.Navkolo.Contracts;

namespace PoliValko.IntegrationTests;

public sealed class ImportCategoriesApiTests(ApiFactory api)
{
    private const string Categories = "/api/v1/console/catalog/categories";
    private const string Import = Categories + "/import";
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Concurrent_replay_adds_hidden_tree_once_and_preserves_existing_category_and_product()
    {
        var product = await api.AddProductAsync("vse-dlia-polyvu", "Товар до імпорту розділів", 40m);
        using var admin = await Staff.AdminAsync(api);
        var before = await admin.ReadAsync<List<ConsoleCategoryDto>>(Categories);
        var existing = before.Single(category => category.Id == product.CategoryId);
        existing.IsVisible.ShouldBeTrue();
        var existingParentSlug = before.SingleOrDefault(category => category.Id == existing.ParentId)?.Slug;
        var root = NewItem();
        var child = NewItem(root.Slug);
        var grandchild = NewItem(child.Slug);
        var existingChild = NewItem(existing.Slug);
        var priorAudits = await AuditCountAsync();
        var priorInvalidations = api.Storefront.Tags.Count(tag => tag == StorefrontTags.Categories);
        var request = new ImportCategoriesRequest([
            root, child, grandchild, new(existing.Name, existing.Slug, existingParentSlug, existing.NavkoloRef!), existingChild,
        ]);

        var responses = await Task.WhenAll(
            admin.PostAsJsonAsync(Import, request, TestJson.Options, Ct),
            admin.PostAsJsonAsync(Import, request, TestJson.Options, Ct));
        var results = await Task.WhenAll(responses.Select(response => response.ReadAsync<ImportCategoriesResult>()));
        results.ShouldContain(new ImportCategoriesResult(4, 1));
        results.ShouldContain(new ImportCategoriesResult(0, 5));

        var after = await admin.ReadAsync<List<ConsoleCategoryDto>>(Categories);
        var newRoot = after.Single(category => category.Slug == root.Slug);
        var newChild = after.Single(category => category.Slug == child.Slug);
        var newGrandchild = after.Single(category => category.Slug == grandchild.Slug);
        var newExistingChild = after.Single(category => category.Slug == existingChild.Slug);
        newRoot.ParentId.ShouldBeNull();
        newChild.ParentId.ShouldBe(newRoot.Id);
        newGrandchild.ParentId.ShouldBe(newChild.Id);
        newExistingChild.ParentId.ShouldBe(existing.Id);
        new[] { newRoot, newChild, newGrandchild, newExistingChild }.ShouldAllBe(category => !category.IsVisible && category.ProductCount == 0);
        var unchanged = after.Single(category => category.Id == existing.Id);
        unchanged.ShouldBe(existing with { FilterAttributes = unchanged.FilterAttributes });
        unchanged.FilterAttributes.ShouldBe(existing.FilterAttributes);
        (await api.WithDbAsync(db => db.Set<Product>().Where(row => row.Id == product.Id).Select(row => row.CategoryId).SingleAsync(Ct))).ShouldBe(existing.Id);
        (await AuditCountAsync()).ShouldBe(priorAudits + 1);
        api.Storefront.Tags.Count(tag => tag == StorefrontTags.Categories).ShouldBe(priorInvalidations + 1);
    }

    [Fact]
    public async Task Staff_can_publish_new_categories_and_their_products_while_respecting_hidden_groups_and_parents()
    {
        const string parentSlug = "vse-dlia-polyvu";
        var root = NewItem(parentSlug);
        var child = NewItem(root.Slug);
        var hiddenByName = NewItem(root.Slug) with { Name = "хЛАМ" };
        var hiddenByRef = NewItem(root.Slug);
        var existingHidden = NewItem();
        var underHidden = NewItem(existingHidden.Slug);
        await using var host = api.WithWebHostBuilder(builder => builder.ConfigureServices(services =>
            services.PostConfigure<CatalogOptions>(options => options.HiddenNavkoloGroups.Add(hiddenByRef.NavkoloRef.ToUpperInvariant()))));
        using var admin = host.CreateClient();
        (await admin.PostAsJsonAsync("/api/v1/console/auth/login", new { email = ApiFactory.AdminEmail, password = ApiFactory.TestPassword }, Ct)).EnsureSuccessStatusCode();
        var csrf = await admin.ReadAsync<CsrfTokenDto>("/api/v1/console/auth/csrf");
        admin.DefaultRequestHeaders.Add(CsrfHeaders.Token, csrf.Token);

        // Older upload clients omit showOnStorefront. Replaying the same row in a published batch keeps its visibility.
        (await admin.PostAsJsonAsync(Import, new { categories = new[] { existingHidden } }, Ct)).EnsureSuccessStatusCode();
        var batch = new ImportCategoriesRequest([root, child, hiddenByName, hiddenByRef, existingHidden, underHidden], ShowOnStorefront: true);
        var imported = await (await admin.PostAsJsonAsync(Import, batch, Ct)).ReadAsync<ImportCategoriesResult>();
        imported.ShouldBe(new ImportCategoriesResult(5, 1));
        var after = await admin.ReadAsync<List<ConsoleCategoryDto>>(Categories);
        foreach (var category in new[] { root, child, underHidden })
            after.Single(row => row.Slug == category.Slug).IsVisible.ShouldBeTrue();
        foreach (var category in new[] { existingHidden, hiddenByName, hiddenByRef })
            after.Single(row => row.Slug == category.Slug).IsVisible.ShouldBeFalse();

        using var customer = host.CreateClient();
        var tree = await customer.ReadAsync<List<CategoryNodeDto>>("/api/v1/categories");
        tree.Single(category => category.Slug == parentSlug).Children.Single(category => category.Slug == root.Slug).Children.Select(category => category.Slug).ShouldBe(new[] { child.Slug });
        foreach (var category in new[] { existingHidden, underHidden, hiddenByName, hiddenByRef })
            (await customer.GetAsync($"/api/v1/categories/{category.Slug}", Ct)).StatusCode.ShouldBe(HttpStatusCode.NotFound);

        var sku = "SITE-" + Guid.NewGuid().ToString("N")[..12];
        using var form = new MultipartFormDataContent();
        form.Add(new StringContent($"navkolo_id;sku;name;group;price;stock\n{sku};{sku};Новий товар;{child.NavkoloRef};199;5", Encoding.UTF8, "text/csv"), "file", "catalog.csv");
        var run = await (await admin.PostAsync("/api/v1/console/integration/navkolo/import", form, Ct)).ReadAsync<ImportRunDto>();
        run.ErrorCount.ShouldBe(0);
        var listing = await customer.ReadAsync<ProductSearchResponse>($"/api/v1/products?category={root.Slug}");
        var product = listing.Items.ShouldHaveSingleItem();
        product.Sku.ShouldBe(sku);
        var details = await customer.ReadAsync<ProductDetailsDto>($"/api/v1/products/{product.Slug}");
        details.Category.Slug.ShouldBe(child.Slug);
    }

    [Fact]
    public async Task Invalid_order_cycles_and_collisions_write_nothing()
    {
        using var admin = await Staff.AdminAsync(api);
        var before = await admin.ReadAsync<List<ConsoleCategoryDto>>(Categories);
        var existing = before.First(category => !string.IsNullOrWhiteSpace(category.NavkoloRef));
        var existingParentSlug = before.SingleOrDefault(category => category.Id == existing.ParentId)?.Slug;
        var valid = NewItem();
        var later = NewItem();
        var child = NewItem(later.Slug);
        var priorAudits = await AuditCountAsync();

        foreach (var invalid in new ImportCategoriesRequest[]
                 {
                     new([valid, child, later]),
                     new([valid, child, later with { ParentSlug = child.Slug }]),
                     new([valid, later with { NavkoloRef = valid.NavkoloRef.ToUpperInvariant() }]),
                     new([valid, later with { Slug = valid.Slug }]),
                 })
        {
            using var response = await admin.PostAsJsonAsync(Import, invalid, TestJson.Options, Ct);
            response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
            (await response.Content.ReadFromJsonAsync<ProblemBody>(Ct))!.Errors!.ShouldContainKey("categories");
        }

        foreach (var collision in new ImportCategoryItem[]
                 {
                     later with { NavkoloRef = existing.NavkoloRef! },
                     new("Змінена назва", existing.Slug, existingParentSlug, existing.NavkoloRef!),
                 })
        {
            using var response = await admin.PostAsJsonAsync(Import, new ImportCategoriesRequest([valid, collision]), TestJson.Options, Ct);
            response.StatusCode.ShouldBe(HttpStatusCode.Conflict);
            (await response.ProblemCodeAsync()).ShouldBe("catalog.category_import_conflict");
        }

        var after = await admin.ReadAsync<List<ConsoleCategoryDto>>(Categories);
        after.Select(category => category.Id).ShouldBe(before.Select(category => category.Id));
        after.Single(category => category.Id == existing.Id).Name.ShouldBe(existing.Name);
        (await AuditCountAsync()).ShouldBe(priorAudits);
    }

    [Fact]
    public async Task Import_requires_category_permissions_csrf_and_explicit_parent()
    {
        using var admin = await Staff.AdminAsync(api);
        using var viewOnly = await TestRoles.LoginWithPermissionsAsync(api, admin, PermissionKeys.ProductsView);
        using var noCsrf = await Staff.SignInAsync(api, ApiFactory.AdminEmail);
        using var guest = api.CreateClient();
        var category = NewItem();
        var request = new ImportCategoriesRequest([category]);

        (await guest.PostAsJsonAsync(Import, request, TestJson.Options, Ct)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        (await viewOnly.PostAsJsonAsync(Import, request, TestJson.Options, Ct)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await noCsrf.PostAsJsonAsync(Import, request, TestJson.Options, Ct)).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var incomplete = new { categories = new[] { new { category.Name, category.Slug, category.NavkoloRef } } };
        (await admin.PostAsJsonAsync(Import, incomplete, TestJson.Options, Ct)).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await admin.ReadAsync<List<ConsoleCategoryDto>>(Categories)).ShouldNotContain(row => row.Slug == category.Slug);
    }

    private static ImportCategoryItem NewItem(string? parentSlug = null)
    {
        var id = Guid.NewGuid().ToString("N");
        return new("Розділ імпорту " + id, "import-" + id, parentSlug, "dntrade-" + id);
    }

    private Task<int> AuditCountAsync() => api.WithDbAsync(db => db.Set<AuditEntry>().CountAsync(entry => entry.Action == "catalog.categories_imported", Ct));
}

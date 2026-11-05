using System.Net;
using System.Net.Http.Json;
using PoliValko.Catalog;
using PoliValko.Catalog.Contracts;
using PoliValko.Catalog.Domain;
using PoliValko.Catalog.Features.Console.AttributeNames;
using PoliValko.Catalog.Features.Console.Attributes;
using PoliValko.Catalog.Features.Console.Categories;
using PoliValko.Catalog.Features.Console.Products;
using PoliValko.Catalog.Features.Storefront;

namespace PoliValko.IntegrationTests;

public sealed class ConsoleAttributeApiTests(ApiFactory api)
{
    private const string Categories = "/api/v1/console/catalog/categories";

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Dictionary_crud_validates_names_kinds_and_aliases()
    {
        var admin = await Staff.AdminAsync(api);
        var name = CatalogDictionaries.Unique("Потужність");

        var created = await (await admin.PostAsJsonAsync(
                CatalogDictionaries.Attributes,
                new SaveAttributeDefinitionRequest($"  {name} ", "Вт", AttributeKind.Number, AttributeFilterView.Range, 5, ["Power", " power ", ""]),
                TestJson.Options,
                Ct))
            .ReadAsync<AttributeDefinitionDto>(HttpStatusCode.Created);
        created.Name.ShouldBe(name);
        created.Unit.ShouldBe("Вт");
        created.Kind.ShouldBe(AttributeKind.Number);
        created.FilterView.ShouldBe(AttributeFilterView.Range);
        created.Aliases.ShouldBe(["Power"]);
        created.ProductCount.ShouldBe(0);
        created.CategoryCount.ShouldBe(0);

        foreach (var (request, field) in new[]
                 {
                     (new SaveAttributeDefinitionRequest(name.ToUpperInvariant(), null, null, null, 0, null), "name"),
                     (new SaveAttributeDefinitionRequest("Power", null, null, null, 0, null), "name"),
                     (new SaveAttributeDefinitionRequest(CatalogDictionaries.Unique("Колір"), null, AttributeKind.List, AttributeFilterView.Range, 0, null), "filterView"),
                     (new SaveAttributeDefinitionRequest(CatalogDictionaries.Unique("Вага"), null, null, null, 0, ["power"]), "aliases"),
                     (new SaveAttributeDefinitionRequest(" ", null, null, null, 0, null), "name"),
                     (new SaveAttributeDefinitionRequest(CatalogDictionaries.Unique("Довжина"), new string('м', 21), null, null, 0, null), "unit"),
                 })
        {
            var invalid = await admin.PostAsJsonAsync(CatalogDictionaries.Attributes, request, TestJson.Options, Ct);
            invalid.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
            (await invalid.Content.ReadFromJsonAsync<ProblemBody>(Ct))!.Errors!.ShouldContainKey(field);
        }

        var updated = await (await admin.PutAsJsonAsync(
                $"{CatalogDictionaries.Attributes}/{created.Id}",
                new SaveAttributeDefinitionRequest(name, "кВт", AttributeKind.List, null, 1, []),
                TestJson.Options,
                Ct))
            .ReadAsync<AttributeDefinitionDto>();
        updated.Kind.ShouldBe(AttributeKind.List);
        updated.FilterView.ShouldBe(AttributeFilterView.Checkboxes);
        updated.Aliases.ShouldBeEmpty();

        (await admin.DeleteAsync($"{CatalogDictionaries.Attributes}/{created.Id}", Ct)).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await admin.ReadAsync<List<AttributeDefinitionDto>>(CatalogDictionaries.Attributes)).ShouldNotContain(a => a.Id == created.Id);
        var missing = await admin.DeleteAsync($"{CatalogDictionaries.Attributes}/{created.Id}", Ct);
        missing.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await missing.ProblemCodeAsync()).ShouldBe("catalog.attribute_not_found");
    }

    [Fact]
    public async Task Rename_rewrites_product_values_and_category_filters_in_one_go()
    {
        var admin = await Staff.AdminAsync(api);
        var oldName = CatalogDictionaries.Unique("Матеріал корпусу");
        var newName = CatalogDictionaries.Unique("Матеріал");
        var product = await api.AddProductAsync("vse-dlia-polyvu", "Розпилювач для перейменування", 210m);
        var other = await api.AddProductAsync("vse-dlia-polyvu", "Лійка для перейменування", 180m);
        await UpdateAttributesAsync(admin, product, [new ProductAttributeDto(oldName, "Латунь"), new ProductAttributeDto("Колір", "Жовтий")]);
        await UpdateAttributesAsync(admin, other, [new ProductAttributeDto(oldName.ToLowerInvariant(), "Пластик")]);

        var definition = (await admin.ReadAsync<List<AttributeDefinitionDto>>(CatalogDictionaries.Attributes)).Single(a => a.Name == oldName);
        definition.ProductCount.ShouldBe(2);

        var parent = (await admin.ReadAsync<List<ConsoleCategoryDto>>(Categories)).Single(c => c.Slug == "vse-dlia-polyvu");
        var category = await (await admin.PostAsJsonAsync(Categories, new SaveCategoryRequest(
                parent.Id, "Розпилювачі", $"rozpyliuvachi-{Guid.NewGuid().ToString("N")[..6]}", 1, true, null, [oldName.ToUpperInvariant()], null, null), TestJson.Options, Ct))
            .ReadAsync<ConsoleCategoryDto>(HttpStatusCode.Created);
        category.FilterAttributes.ShouldBe([oldName]);
        (await admin.ReadAsync<List<AttributeDefinitionDto>>(CatalogDictionaries.Attributes)).Single(a => a.Id == definition.Id).CategoryCount.ShouldBe(1);

        var renamed = await (await admin.PutAsJsonAsync(
                $"{CatalogDictionaries.Attributes}/{definition.Id}",
                new SaveAttributeDefinitionRequest(newName, null, null, null, definition.SortOrder, null),
                TestJson.Options,
                Ct))
            .ReadAsync<AttributeDefinitionDto>();
        renamed.Name.ShouldBe(newName);
        renamed.ProductCount.ShouldBe(2);
        renamed.CategoryCount.ShouldBe(1);

        (await admin.ReadAsync<ConsoleProductDto>($"/api/v1/console/catalog/products/{product.Id}")).Attributes
            .ShouldBe([new ProductAttributeDto(newName, "Латунь"), new ProductAttributeDto("Колір", "Жовтий")]);
        (await admin.ReadAsync<ConsoleProductDto>($"/api/v1/console/catalog/products/{other.Id}")).Attributes
            .ShouldBe([new ProductAttributeDto(newName, "Пластик")]);
        (await admin.ReadAsync<List<ConsoleCategoryDto>>(Categories)).Single(c => c.Id == category.Id).FilterAttributes.ShouldBe([newName]);
        var details = await api.CreateClient().GetFromJsonAsync<ProductDetailsDto>($"/api/v1/products/{product.Slug}", TestJson.Options, Ct);
        details!.Attributes.ShouldContain(new ProductAttributeDto(newName, "Латунь"));

        var taken = await admin.PutAsJsonAsync(
            $"{CatalogDictionaries.Attributes}/{definition.Id}",
            new SaveAttributeDefinitionRequest("Колір", null, null, null, 0, null),
            TestJson.Options,
            Ct);
        taken.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Filter_in_use_blocks_deletion_and_categories_accept_only_dictionary_names()
    {
        var admin = await Staff.AdminAsync(api);
        var name = CatalogDictionaries.Unique("Діаметр");
        var definition = await CatalogDictionaries.EnsureAttributeAsync(admin, name);
        var parent = (await admin.ReadAsync<List<ConsoleCategoryDto>>(Categories)).Single(c => c.Slug == "vse-dlia-polyvu");
        var slug = $"shlanhy-{Guid.NewGuid().ToString("N")[..6]}";

        var unknown = await admin.PostAsJsonAsync(Categories, new SaveCategoryRequest(
            parent.Id, "Шланги", slug, 1, true, null, [name, "Немає такої"], null, null), TestJson.Options, Ct);
        unknown.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = (await unknown.Content.ReadFromJsonAsync<ProblemBody>(Ct))!;
        problem.Errors!["filterAttributes"].ShouldHaveSingleItem().ShouldContain("Немає такої");

        var category = await (await admin.PostAsJsonAsync(Categories, new SaveCategoryRequest(
                parent.Id, "Шланги", slug, 1, true, null, [name], null, null), TestJson.Options, Ct))
            .ReadAsync<ConsoleCategoryDto>(HttpStatusCode.Created);
        var product = await api.AddProductAsync("vse-dlia-polyvu", "Шланг з діаметром", 300m);
        await UpdateAttributesAsync(admin, product, [new ProductAttributeDto(name, "1/2")]);

        var blocked = await admin.DeleteAsync($"{CatalogDictionaries.Attributes}/{definition.Id}", Ct);
        blocked.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        var conflict = (await blocked.Content.ReadFromJsonAsync<Dictionary<string, object>>(Ct))!;
        conflict["code"].ToString().ShouldBe("attributes.in_filters");
        conflict["categoryCount"].ToString().ShouldBe("1");

        await (await admin.PutAsJsonAsync($"{Categories}/{category.Id}", new SaveCategoryRequest(
                parent.Id, "Шланги", slug, 1, true, null, [], null, null), TestJson.Options, Ct))
            .ReadAsync<ConsoleCategoryDto>();
        (await admin.DeleteAsync($"{CatalogDictionaries.Attributes}/{definition.Id}", Ct)).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await admin.ReadAsync<ConsoleProductDto>($"/api/v1/console/catalog/products/{product.Id}")).Attributes
            .ShouldBe([new ProductAttributeDto(name, "1/2")]);
    }

    [Fact]
    public async Task Startup_sync_adds_definitions_for_product_and_filter_names_once()
    {
        var name = CatalogDictionaries.Unique("Із синхронізації");
        var product = await api.AddProductAsync("vse-dlia-roslyn", "Товар для синхронізації", 90m);
        await api.WithDbAsync(async db =>
        {
            db.Add(new ProductAttribute { Id = Guid.CreateVersion7(), ProductId = product.Id, Name = name, Value = "Так", SortOrder = 0 });
            return await db.SaveChangesAsync(Ct);
        });

        await api.WithScopeAsync(async services =>
        {
            await CatalogModule.SyncDictionariesAsync(services, Ct);
            await CatalogModule.SyncDictionariesAsync(services, Ct);
            return true;
        });

        var admin = await Staff.AdminAsync(api);
        (await admin.ReadAsync<List<AttributeDefinitionDto>>(CatalogDictionaries.Attributes))
            .Where(a => string.Equals(a.Name, name, StringComparison.OrdinalIgnoreCase))
            .ShouldHaveSingleItem()
            .ProductCount.ShouldBe(1);
        (await admin.ReadAsync<List<AttributeNameDto>>("/api/v1/console/catalog/attribute-names")).ShouldContain(new AttributeNameDto(name, 1));
    }

    [Fact]
    public async Task Manager_reads_the_dictionary_but_cannot_change_it()
    {
        var manager = await Staff.ManagerAsync(api);
        (await manager.GetAsync(CatalogDictionaries.Attributes, Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        var denied = await manager.PostAsJsonAsync(
            CatalogDictionaries.Attributes,
            new SaveAttributeDefinitionRequest(CatalogDictionaries.Unique("Менеджерська"), null, null, null, 0, null),
            TestJson.Options,
            Ct);
        denied.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await denied.ProblemCodeAsync()).ShouldBe("auth.forbidden");
    }

    private static async Task UpdateAttributesAsync(HttpClient admin, Product product, IReadOnlyList<ProductAttributeDto> attributes) =>
        await (await admin.PutAsJsonAsync(
                $"/api/v1/console/catalog/products/{product.Id}",
                new UpdateProductRequest(null, null, null, null, null, true, null, null, attributes),
                TestJson.Options,
                Ct))
            .ReadAsync<ConsoleProductDto>();
}

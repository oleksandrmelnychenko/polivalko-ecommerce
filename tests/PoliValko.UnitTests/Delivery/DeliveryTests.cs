using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using PoliValko.Delivery.Domain;
using PoliValko.Delivery.Features.Admin;
using PoliValko.Delivery.Features.Directory;
using PoliValko.Delivery.Features.DirectorySync;
using PoliValko.Delivery.Integrations.NovaPoshta;
using PoliValko.Delivery.Persistence;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.UnitTests;

public sealed class NovaPoshtaTextTests
{
    [Theory]
    [InlineData("  Кам’янець-Подільський ", "кам'янець-подільський")]
    [InlineData("КАМʼЯНКА", "кам'янка")]
    [InlineData("Біла   Церква", "біла церква")]
    [InlineData(null, "")]
    [InlineData("   ", "")]
    public void Normalize_lowercases_and_unifies_apostrophes_and_spaces(string? value, string expected) =>
        NovaPoshtaText.Normalize(value).ShouldBe(expected);

    [Fact]
    public void Like_wildcards_are_escaped() =>
        NovaPoshtaText.EscapeLike(@"50%_a\").ShouldBe(@"50\%\_a\\");
}

public sealed class PickupPointValidationTests
{
    [Fact]
    public void Valid_request_is_trimmed_and_empty_map_url_becomes_null()
    {
        var errors = UpdatePickupPoint.Validate(
            new UpdatePickupPointRequest(" Магазин у Бучі ", " вул. Вокзальна, 1 ", "Пн–Пт 9–18", "Назвіть номер замовлення.", "  ", true),
            out var values);

        errors.ShouldBeEmpty();
        values.ShouldBe(new UpdatePickupPoint.PickupPointValues("Магазин у Бучі", "вул. Вокзальна, 1", "Пн–Пт 9–18", "Назвіть номер замовлення.", null, true));
    }

    [Fact]
    public void Invalid_request_reports_every_field()
    {
        var errors = UpdatePickupPoint.Validate(
            new UpdatePickupPointRequest("М", "", new string('x', 201), null, "javascript:alert(1)", null),
            out _);

        errors.Keys.ShouldBe(["name", "address", "schedule", "instructions", "mapUrl", "isActive"], ignoreOrder: true);
    }
}

public sealed class DeliveryModelTests
{
    [Fact]
    public void Raw_recount_sql_matches_model_table_and_column_names()
    {
        using var db = CreateContext();
        var settlements = Model(db).FindEntityType(typeof(NpSettlement))!;
        var warehouses = Model(db).FindEntityType(typeof(NpWarehouse))!;

        settlements.GetSchema().ShouldBe(Schemas.Delivery);
        settlements.GetTableName().ShouldBe("np_settlements");
        warehouses.GetSchema().ShouldBe(Schemas.Delivery);
        warehouses.GetTableName().ShouldBe("np_warehouses");
        settlements.FindProperty(nameof(NpSettlement.Ref))!.GetColumnName().ShouldBe("ref");
        settlements.FindProperty(nameof(NpSettlement.ActiveWarehouseCount))!.GetColumnName().ShouldBe("active_warehouse_count");
        warehouses.FindProperty(nameof(NpWarehouse.Ref))!.GetColumnName().ShouldBe("ref");
        warehouses.FindProperty(nameof(NpWarehouse.SettlementRef))!.GetColumnName().ShouldBe("settlement_ref");
        warehouses.FindProperty(nameof(NpWarehouse.IsActive))!.GetColumnName().ShouldBe("is_active");

        var sql = NovaPoshtaDirectorySync.RecountActiveWarehousesSql;
        sql.ShouldContain("delivery.np_settlements");
        sql.ShouldContain("delivery.np_warehouses");
        sql.ShouldContain("active_warehouse_count");
        sql.ShouldContain("settlement_ref");
    }

    [Fact]
    public void Settlement_search_column_has_prefix_index()
    {
        using var db = CreateContext();
        var settlements = Model(db).FindEntityType(typeof(NpSettlement))!;

        var index = settlements.GetIndexes().ShouldHaveSingleItem();
        index.Properties.ShouldHaveSingleItem().Name.ShouldBe(nameof(NpSettlement.SearchName));
        index.GetOperators().ShouldBe(["text_pattern_ops"]);
    }

    [Fact]
    public void Pickup_point_is_seeded_with_bucha_store()
    {
        using var db = CreateContext();
        var pickup = Model(db).FindEntityType(typeof(PickupLocation))!;

        pickup.GetTableName().ShouldBe("pickup_points");
        var seed = pickup.GetSeedData().ShouldHaveSingleItem();
        seed[nameof(PickupLocation.Code)].ShouldBe(DeliveryModelConfigurator.BuchaStoreCode);
        seed[nameof(PickupLocation.Name)].ShouldBe("Магазин Poli Valko у Бучі");
        seed[nameof(PickupLocation.IsActive)].ShouldBe(true);
    }

    [Fact]
    public void Settlement_search_translates_to_prefix_like()
    {
        using var db = CreateContext();

        var search = NovaPoshtaDbDirectory.SearchSettlements(db.Set<NpSettlement>(), "Буч", 20).ToQueryString();
        search.ShouldContain("LIKE");
        search.ShouldContain("буч%");
        search.ShouldContain("active_warehouse_count");

        var popular = NovaPoshtaDbDirectory.SearchSettlements(db.Set<NpSettlement>(), "Б", 20).ToQueryString();
        popular.ShouldNotContain("LIKE");
        popular.ShouldContain("active_warehouse_count DESC");
        popular.ShouldContain("LIMIT");
    }

    [Fact]
    public void Warehouses_query_filters_city_and_orders_branches_first()
    {
        using var db = CreateContext();

        var sql = NovaPoshtaDbDirectory.WarehousesIn(db.Set<NpWarehouse>(), "city-1", "Хрещатик").ToQueryString();

        sql.ShouldContain("settlement_ref");
        sql.ShouldContain("is_active");
        sql.ShouldContain("search_text");
        sql.ShouldContain("'Branch'");
    }

    private static PoliValkoDbContext CreateContext() =>
        new(
            new DbContextOptionsBuilder<PoliValkoDbContext>()
                .UseNpgsql("Host=localhost;Database=model-only")
                .UseSnakeCaseNamingConvention()

                .EnableServiceProviderCaching(false)
                .Options,
            [new DeliveryModelConfigurator()]);

    private static IModel Model(DbContext db) => db.GetService<IDesignTimeModel>().Model;
}

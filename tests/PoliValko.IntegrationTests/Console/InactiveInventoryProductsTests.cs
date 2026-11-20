using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PoliValko.Console.Features.Accounting;
using PoliValko.Infrastructure.Security.Permissions;

namespace PoliValko.IntegrationTests;

public sealed class InactiveInventoryProductsTests(ApiFactory api)
{
    [Fact]
    public async Task Matching_deactivated_lines_create_one_hidden_product_without_opening_stock()
    {
        var ct = TestContext.Current.CancellationToken;
        using var staff = await Staff.AdminAsync(api);
        var store = Guid.NewGuid().ToString();
        var code = Random.Shared.NextInt64(10000000000, 99999999999).ToString();
        object Row(string section, params string[] values) => new { section, cells = values.Select(value => new { value }) };
        var cutoff = new { cutoff = "2026-11-20", scope = new { warehouses = store, groupProductVariants = false },
            tables = new[] { new[] { Row("THEAD","Код","Назва","Од.вим.","Ціна","На початок","Прихід","Розхід","Залишок","Залишок в сумі"),
                Row("TBODY",code,"Спиця","шт","10","0","5","1","4","40"),
                Row("TBODY",code+"1","Спиця","шт","10","0","6","1","5","50") } } };
        var supplement = new { scope = new { warehouses = new[] {store} },
            tables = new[] { new[] { Row("THEAD","Код","Назва","Одиниця","Штрихкод","Залишок","Закупівельна ціна","Роздрібна ціна","Статус"),
                Row("TBODY",code,"Спиця","шт","00123","4","5.71","10.01","Деактивований"),
                Row("TBODY",code+"1","Спиця","шт","00123","4","5.71","10.01","Деактивований") } },
            products = new[]{code,code+"1"}.Select(sku => new {sku,name="Спиця",unit="шт",barcode="00123",onHand="4",
                purchasePrice="5.71",retailPrice="10.01",status="deactivated"}) };
        object Snapshot(string suffix, object raw) => new {schemaVersion=1,source="dntrade",entityType="inventorySnapshot",
            sourceId=store+suffix,sourceDate="2026-11-20",raw};
        var body = string.Join("\n", new[]{Snapshot("cut",cutoff),Snapshot("inactive",supplement)}.Select(o => JsonSerializer.Serialize(o)));
        (await staff.PostAsync("/api/v1/console/dntrade-archive/import?sourceAccount=valko-dntrade",
            new StringContent(body,Encoding.UTF8,"application/x-ndjson"),ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        await api.WithDbAsync(db => db.Database.ExecuteSqlRawAsync("""
            INSERT INTO catalog.categories(id,slug,name,sort_order,is_visible)
            VALUES(gen_random_uuid(),'dntrade-uncategorized','Без категорії',0,false) ON CONFLICT DO NOTHING
            """,ct));
        const string reports = "/api/v1/console/accounting/inventory-reports";
        var id = (await staff.ReadAsync<List<InventoryReport>>(reports)).Single(x => x.SourceId == store+"cut").Id;
        var url = $"{reports}/{id}/inactive-products";
        var row = (await staff.ReadAsync<List<InactiveInventoryProduct>>(url)).Single();
        row.Status.ShouldBe("available");
        var command = new LinkInactiveProduct(row.EvidenceId,row.EvidencePosition,row.Code);
        using var viewer = await TestRoles.LoginWithPermissionsAsync(api,staff,PermissionKeys.AccountingView);
        (await viewer.PostAsJsonAsync($"{url}/{row.Position}",command,ct)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await staff.PostAsJsonAsync($"{url}/{row.Position}",command with {Code="different"},ct)).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        var replies = await Task.WhenAll(staff.PostAsJsonAsync($"{url}/{row.Position}",command,ct),
            staff.PostAsJsonAsync($"{url}/{row.Position}",command,ct));
        replies.ShouldAllBe(x => x.StatusCode == HttpStatusCode.OK);
        var linked = (await staff.ReadAsync<List<InactiveInventoryProduct>>(url)).Single();
        linked.Status.ShouldBe("linked");
        foreach (var reply in replies) (await reply.Content.ReadFromJsonAsync<Guid>(ct)).ShouldBe(linked.ProductId!.Value);
        var count = await api.WithDbAsync(db => db.Database.SqlQuery<int>($"""
                SELECT count(*)::int AS "Value" FROM catalog.products p JOIN catalog.product_prices pp ON pp.product_id=p.id
                JOIN catalog.product_stock s ON s.product_id=p.id JOIN catalog.product_attributes a ON a.product_id=p.id
                WHERE p.id={linked.ProductId} AND NOT p.is_visible AND s.quantity=0 AND pp.amount=10.01
                  AND a.name='Штрихкод' AND a.value='00123'
                  AND NOT EXISTS (SELECT 1 FROM accounting.warehouse_stock w WHERE w.product_id=p.id)
                """).SingleAsync(ct));
        count.ShouldBe(1);
    }
}

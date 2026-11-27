using System.Net;
using System.Net.Http.Json;
using System.Text;
using Microsoft.Extensions.DependencyInjection;
using PoliValko.Catalog.Contracts;
using PoliValko.Catalog.Features.Storefront;
using PoliValko.Console.Features.Accounting;
using PoliValko.Ordering.Features.Checkout;

namespace PoliValko.IntegrationTests;

public sealed class WarehouseShopTests(ApiFactory api)
{
    private const string Root="/api/v1/console/accounting";
    private static CancellationToken Ct=>TestContext.Current.CancellationToken;
    private sealed record References(List<RegisterReference> Organizations,List<RegisterReference> Stores);

    [Fact]
    public async Task Shop_reserves_and_ships_from_confirmed_warehouse_once()
    {
        using var admin=await Staff.AdminAsync(api);
        using var shop=api.CreateClient();
        var account="shop-stock-"+Guid.NewGuid().ToString("N");
        var seed="""
            {"schemaVersion":1,"source":"dntrade","entityType":"invoice","sourceId":"orgdoc","documentType":"in","organizationId":"org","raw":{"organization":{"title":"Warehouse shop test org"}}}
            {"schemaVersion":1,"source":"dntrade","entityType":"store","sourceId":"store","raw":{"title":"Warehouse shop test store"}}
            """;
        (await admin.PostAsync("/api/v1/console/dntrade-archive/import?sourceAccount="+account,
            new StringContent(seed,Encoding.UTF8,"application/x-ndjson"),Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        var refs=await admin.ReadAsync<References>(Root+"/references");
        var org=Guid.Parse(refs.Organizations.Single(r=>r.Title=="Warehouse shop test org").Id);
        var store=Guid.Parse(refs.Stores.Single(r=>r.Title=="Warehouse shop test store").Id);
        var product=await api.AddProductAsync("ruchnyi-instrument","Склад вітрини",100m,stock:8);
        var partner=new NewPartner(Guid.NewGuid(),"Покупець зі складу","individual");
        (await admin.PostAsJsonAsync(Root+"/partners",partner,Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        var day=new DateOnly(2026,11,20);
        var opening=new StockOpening(Guid.NewGuid(),org,store,product.Id,3.5m,day,"Інвентаризація");
        (await admin.PostAsJsonAsync(Root+"/warehouse/openings",opening,Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        async Task<OrderCreatedDto> Checkout(int qty)
        {
            var body=CheckoutApiTests.Order(product.Id,qty,(qty*100)+".00",CheckoutApiTests.UniquePhone());
            return await (await new CheckoutApiTests(api).PostOrderAsync(body,Guid.NewGuid().ToString())).ReadAsync<OrderCreatedDto>(HttpStatusCode.Created);
        }
        async Task<WarehouseBalance> Stock() => (await admin.ReadAsync<RegisterPage<WarehouseBalance>>(Root+"/warehouse?store="+store)).Items.Single();
        var order=await Checkout(2);
        var connect=new ConnectWarehouse(org,store,null,null,3.5m,8m,2m);
        var link=Root+"/warehouse/shop-source/"+product.Id;
        (await admin.PutAsJsonAsync(link,connect with {Reserved=0m},Ct)).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await admin.PutAsJsonAsync(link,connect,Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await admin.PutAsJsonAsync(link,connect,Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await Stock()).ShopQuantity.ShouldBe(3.5m);
        await api.WithScopeAsync(async sp=>{
            await sp.GetRequiredService<ICatalogImporter>().ApplyPriceStockAsync([new(product.NavkoloId,100m,null,50m)],Ct);
            return true;
        });
        (await Stock()).ShopQuantity.ShouldBe(3.5m);
        var draft=new NewDraft(Guid.NewGuid(),partner.Id,"out","walk-in",day,org.ToString(),store.ToString(),[new(product.Id,2m,100m)]);
        var doc=Root+"/documents/"+draft.Id;
        (await admin.PostAsJsonAsync(Root+"/drafts",draft,Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        var revision=(await admin.ReadAsync<InvoiceState>(doc+"/operations")).Revision;
        (await admin.PostAsJsonAsync(doc+"/post",new PostInvoice(revision),Ct)).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        var orderUrl="/api/v1/console/orders/"+order.Number+"/status";
        foreach (var status in new[]{"confirmed","shipped","completed"})
            (await admin.PostAsJsonAsync(orderUrl,new {status},Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        var shipped=await Stock();
        shipped.Quantity.ShouldBe(1.5m);
        shipped.Reserved.ShouldBe(0m);
        shipped.ShopQuantity.ShouldBe(1.5m);
        var moves=await admin.ReadAsync<RegisterPage<WarehouseMovement>>(Root+"/warehouse/"+product.Id+"/movements?org="+org+"&store="+store);
        moves.Items.Single(m=>m.Kind=="order").Reference.ShouldBe(order.Number);
        var reserved=await Checkout(1);
        var itemUrl="/api/v1/products/"+product.Slug;
        (await shop.ReadAsync<ProductDetailsDto>(itemUrl)).InStock.ShouldBeFalse();
        (await admin.PostAsJsonAsync("/api/v1/console/orders/"+reserved.Number+"/status",new {status="cancelled"},Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await shop.ReadAsync<ProductDetailsDto>(itemUrl)).InStock.ShouldBeTrue();
        var edit=new DraftChange(revision,draft with {Lines=[new(product.Id,1m,100m)]});
        (await admin.PutAsJsonAsync(Root+"/drafts/"+draft.Id,edit,Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        var edited=new PostInvoice((await admin.ReadAsync<InvoiceState>(doc+"/operations")).Revision);
        foreach (var retry in Enumerable.Range(0,2))
            (await admin.PostAsJsonAsync(doc+"/post",edited,Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await Stock()).ShopQuantity.ShouldBe(0.5m);
        (await shop.ReadAsync<ProductDetailsDto>(itemUrl)).InStock.ShouldBeFalse();
        var receipt=draft with {Id=Guid.NewGuid(),Kind="in",Number="new-delivery"};
        (await admin.PostAsJsonAsync(Root+"/drafts",receipt,Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        var receiptUrl=Root+"/documents/"+receipt.Id;
        var postReceipt=new PostInvoice((await admin.ReadAsync<InvoiceState>(receiptUrl+"/operations")).Revision);
        (await admin.PostAsJsonAsync(receiptUrl+"/post",postReceipt,Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await Stock()).ShopQuantity.ShouldBe(2.5m);
        (await shop.ReadAsync<ProductDetailsDto>(itemUrl)).InStock.ShouldBeTrue();
    }

    [Fact]
    public async Task Bulk_connect_and_disconnect_manage_shop_warehouse_sources_cleanly()
    {
        using var admin = await Staff.AdminAsync(api);
        var suffix = Guid.NewGuid().ToString("N")[..8];
        var org = await (await admin.PostAsJsonAsync(Root + "/references/organizations",
            new ReferenceRequest("Bulk Org " + suffix), Ct)).ReadAsync<RegisterReference>();
        var store = await (await admin.PostAsJsonAsync(Root + "/references/stores",
            new ReferenceRequest("Bulk Store " + suffix), Ct)).ReadAsync<RegisterReference>();
        var orgId = Guid.Parse(org.Id);
        var storeId = Guid.Parse(store.Id);
        var day = new DateOnly(2026, 11, 23);

        var p1 = await api.AddProductAsync("ruchnyi-instrument", "Товар Bulk 1 " + suffix, 100m, stock: 1);
        var p2 = await api.AddProductAsync("ruchnyi-instrument", "Товар Bulk 2 " + suffix, 100m, stock: 1);
        (await admin.PostAsJsonAsync(Root + "/warehouse/openings",
            new StockOpening(Guid.NewGuid(), orgId, storeId, p1.Id, 7m, day, "Оп 1"), Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await admin.PostAsJsonAsync(Root + "/warehouse/openings",
            new StockOpening(Guid.NewGuid(), orgId, storeId, p2.Id, 4m, day, "Оп 2"), Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);

        var bulk = await (await admin.PostAsJsonAsync(Root + "/warehouse/shop-source/bulk",
            new ConnectWarehouseBulk(orgId, storeId), Ct)).ReadAsync<BulkWarehouseConnection>();
        bulk.Connected.ShouldBe(2);
        bulk.Skipped.ShouldBe(0);
        bulk.Conflicts.ShouldBeEmpty();

        // Second call skips already connected items.
        var again = await (await admin.PostAsJsonAsync(Root + "/warehouse/shop-source/bulk",
            new ConnectWarehouseBulk(orgId, storeId), Ct)).ReadAsync<BulkWarehouseConnection>();
        again.Connected.ShouldBe(0);
        again.Skipped.ShouldBe(2);

        var balances = (await admin.ReadAsync<RegisterPage<WarehouseBalance>>(Root + "/warehouse?store=" + storeId)).Items;
        balances.Single(b => b.ProductId == p1.Id).ShouldSatisfyAllConditions(
            b => b.SourceStoreId.ShouldBe(storeId),
            b => b.ShopQuantity.ShouldBe(7m));

        // Disconnect p1 succeeds and clears sourceStoreId.
        (await admin.DeleteAsync(Root + "/warehouse/shop-source/" + p1.Id, Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        var afterDisconnect = (await admin.ReadAsync<RegisterPage<WarehouseBalance>>(Root + "/warehouse?store=" + storeId)).Items;
        afterDisconnect.Single(b => b.ProductId == p1.Id).SourceStoreId.ShouldBeNull();

        // Reserve p2 via storefront checkout -> disconnect must return 409 Conflict.
        var body = CheckoutApiTests.Order(p2.Id, 1, "100.00", CheckoutApiTests.UniquePhone());
        (await new CheckoutApiTests(api).PostOrderAsync(body, Guid.NewGuid().ToString())).StatusCode.ShouldBe(HttpStatusCode.Created);
        (await admin.DeleteAsync(Root + "/warehouse/shop-source/" + p2.Id, Ct)).StatusCode.ShouldBe(HttpStatusCode.Conflict);
    }
}

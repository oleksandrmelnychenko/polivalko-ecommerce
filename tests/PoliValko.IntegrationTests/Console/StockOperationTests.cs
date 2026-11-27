using System.Net;
using System.Net.Http.Json;
using System.Text;
using PoliValko.Catalog.Contracts;
using PoliValko.Console.Features.Accounting;

namespace PoliValko.IntegrationTests;

public sealed class StockOperationTests(ApiFactory api)
{
    private const string Root="/api/v1/console/accounting";
    private static CancellationToken Ct=>TestContext.Current.CancellationToken;
    private sealed record References(List<RegisterReference> Organizations,List<RegisterReference> Stores);

    [Fact]
    public async Task Receipts_write_offs_and_recounts_move_stock_without_a_partner()
    {
        using var admin=await Staff.AdminAsync(api);
        var account="stock-ops-"+Guid.NewGuid().ToString("N");
        var seed="""
            {"schemaVersion":1,"source":"dntrade","entityType":"invoice","sourceId":"orgdoc","documentType":"in","organizationId":"org","raw":{"organization":{"title":"Stock operations test org"}}}
            {"schemaVersion":1,"source":"dntrade","entityType":"store","sourceId":"store","raw":{"title":"Stock operations test store"}}
            """;
        (await admin.PostAsync("/api/v1/console/dntrade-archive/import?sourceAccount="+account,
            new StringContent(seed,Encoding.UTF8,"application/x-ndjson"),Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        var refs=await admin.ReadAsync<References>(Root+"/references");
        var org=Guid.Parse(refs.Organizations.Single(r=>r.Title=="Stock operations test org").Id);
        var store=Guid.Parse(refs.Stores.Single(r=>r.Title=="Stock operations test store").Id);
        var product=await api.AddProductAsync("ruchnyi-instrument","Базарний товар",100m,stock:8);
        var day=new DateOnly(2026,11,20);
        (await admin.PostAsJsonAsync(Root+"/warehouse/openings",new StockOpening(Guid.NewGuid(),org,store,product.Id,5m,day,"Перерахунок"),Ct))
            .StatusCode.ShouldBe(HttpStatusCode.OK);
        async Task<decimal> Stock() => (await admin.ReadAsync<RegisterPage<WarehouseBalance>>(Root+"/warehouse?store="+store)).Items.Single().Quantity;
        StockOperationDraft Draft(string kind,decimal quantity,decimal? price=null,string? reason=null,string? comment=null) =>
            new(Guid.NewGuid(),kind,day,org,store,reason,comment,[new(product.Id,quantity,price)]);
        async Task<StockOperationState> Create(StockOperationDraft draft)
        {
            (await admin.PostAsJsonAsync(Root+"/stock-operations",draft,Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
            (await admin.PostAsJsonAsync(Root+"/stock-operations",draft,Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
            return await admin.ReadAsync<StockOperationState>(Root+"/stock-operations/"+draft.Id);
        }
        Task<HttpResponseMessage> Post(StockOperationState state) =>
            admin.PostAsJsonAsync(Root+"/stock-operations/"+state.Id+"/post",new PostStockOperation(state.Revision),Ct);

        foreach (var invalid in new[]{Draft("income",1m,0m),Draft("income",1m),Draft("writeOff",1m),Draft("writeOff",1m,reason:"other"),
                     Draft("recount",-1m),Draft("writeOff",1m,5m,"loss"),Draft("income",1m,10m) with {Lines=[new(product.Id,1m,10m),new(product.Id,2m,10m)]}})
            (await admin.PostAsJsonAsync(Root+"/stock-operations",invalid,Ct)).StatusCode.ShouldBe(HttpStatusCode.BadRequest);

        var early=await Create(Draft("income",1m,10m) with {Day=day.AddDays(-1)});
        (await Post(early)).StatusCode.ShouldBe(HttpStatusCode.Conflict);

        var income=await Create(Draft("income",3m,40.5m));
        income.Number.ShouldStartWith("ОП-");
        income.Total.ShouldBe("121.50");
        income.Lines.Single().ShouldSatisfyAllConditions(l=>l.Before.ShouldBe(5m),l=>l.Change.ShouldBe(3m),l=>l.After.ShouldBe(8m),
            l=>l.FirstMovement.ShouldBeFalse());
        // A product that never moved on this warehouse is flagged: posting would close its opening balance.
        var fresh=await api.AddProductAsync("ruchnyi-instrument","Без початкового залишку",50m,stock:0);
        var untouched=await Create(Draft("income",1m,10m) with {Lines=[new(fresh.Id,1m,10m)]});
        untouched.Lines.Single().FirstMovement.ShouldBeTrue();
        foreach (var retry in Enumerable.Range(0,2)) (await Post(income)).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await Stock()).ShouldBe(8m);
        var card=await admin.ReadAsync<DocumentCard>(Root+"/documents/"+income.Id);
        card.Document.PartnerId.ShouldBeNull();
        card.Lines.Single().CatalogId.ShouldBe(product.Id);
        (await admin.ReadAsync<RegisterPage<DocumentRow>>(Root+"/documents?register=income")).Items.ShouldContain(d=>d.Id==income.Id);

        var writeOff=await Create(Draft("writeOff",10m,reason:"defect"));
        (await Post(writeOff)).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        var smaller=new StockOperationChange(writeOff.Revision,Draft("writeOff",2m,reason:"defect") with {Id=writeOff.Id});
        (await admin.PutAsJsonAsync(Root+"/stock-operations/"+writeOff.Id,smaller,Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await admin.PutAsJsonAsync(Root+"/stock-operations/"+writeOff.Id,smaller,Ct)).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        writeOff=await admin.ReadAsync<StockOperationState>(Root+"/stock-operations/"+writeOff.Id);
        writeOff.Reason.ShouldBe("defect");
        writeOff.Total.ShouldBeNull();
        (await Post(writeOff)).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await Stock()).ShouldBe(6m);

        // Counted 4 while the book said 6; one more is written off before the recount is posted.
        var recount=await Create(Draft("recount",4m));
        recount.Lines.Single().Book.ShouldBe(6m);
        recount.Number.ShouldStartWith("ПР-");
        var later=await Create(Draft("writeOff",1m,reason:"other",comment:"Подарунок клієнту"));
        later.Number.ShouldStartWith("СП-");
        (await Post(later)).StatusCode.ShouldBe(HttpStatusCode.OK);
        // Editing the counted draft after the write-off keeps the book quantity it was counted against.
        var note=new StockOperationChange(recount.Revision,Draft("recount",4m,comment:"Рахував склад") with {Id=recount.Id});
        (await admin.PutAsJsonAsync(Root+"/stock-operations/"+recount.Id,note,Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        recount=await admin.ReadAsync<StockOperationState>(Root+"/stock-operations/"+recount.Id);
        recount.Lines.Single().Book.ShouldBe(6m);
        recount.Comment.ShouldBe("Рахував склад");
        (await Post(recount)).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await Stock()).ShouldBe(3m);
        var counted=(await admin.ReadAsync<StockOperationState>(Root+"/stock-operations/"+recount.Id)).Lines.Single();
        counted.ShouldSatisfyAllConditions(l=>l.Book.ShouldBe(6m),l=>l.Before.ShouldBe(5m),l=>l.Change.ShouldBe(-2m),l=>l.After.ShouldBe(3m));

        var unchanged=await Create(Draft("recount",3m));
        (await Post(unchanged)).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await admin.ReadAsync<StockOperationState>(Root+"/stock-operations/"+unchanged.Id)).Status.ShouldBe("posted");
        var moves=await admin.ReadAsync<RegisterPage<WarehouseMovement>>(Root+"/warehouse/"+product.Id+"/movements?org="+org+"&store="+store);
        // All on one day: newest first in posting order, so each balance follows from the row below it.
        moves.Items.Select(m=>m.Kind).ShouldBe(["recount","writeOff","writeOff","income","opening"]);
        moves.Items.Select(m=>m.Balance).ShouldBe([3m,5m,6m,8m,5m]);

        // A shop selling from this warehouse follows posted operations.
        var shop=(await admin.ReadAsync<RegisterPage<WarehouseBalance>>(Root+"/warehouse?store="+store)).Items.Single();
        (await admin.PutAsJsonAsync(Root+"/warehouse/shop-source/"+product.Id,
            new ConnectWarehouse(org,store,null,null,3m,shop.ShopQuantity!.Value,shop.Reserved!.Value),Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        var restock=await Create(Draft("income",2m,10m));
        (await Post(restock)).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await admin.ReadAsync<RegisterPage<WarehouseBalance>>(Root+"/warehouse?store="+store)).Items.Single().ShopQuantity.ShouldBe(5m);
    }

    [Fact]
    public async Task Transfers_move_stock_between_warehouses_and_draft_delete_and_unpost_work_atomically()
    {
        using var admin = await Staff.AdminAsync(api);
        var org = await (await admin.PostAsJsonAsync(Root + "/references/organizations",
            new ReferenceRequest("Transfer Org " + Guid.NewGuid().ToString("N")[..8]), Ct)).ReadAsync<RegisterReference>();
        var storeA = await (await admin.PostAsJsonAsync(Root + "/references/stores",
            new ReferenceRequest("Transfer Store A " + Guid.NewGuid().ToString("N")[..8]), Ct)).ReadAsync<RegisterReference>();
        var storeB = await (await admin.PostAsJsonAsync(Root + "/references/stores",
            new ReferenceRequest("Transfer Store B " + Guid.NewGuid().ToString("N")[..8]), Ct)).ReadAsync<RegisterReference>();
        var orgId = Guid.Parse(org.Id);
        var storeAId = Guid.Parse(storeA.Id);
        var storeBId = Guid.Parse(storeB.Id);
        var product = await api.AddProductAsync("ruchnyi-instrument", "Товар переміщення", 120m, stock: 10);
        var day = new DateOnly(2026, 11, 22);

        (await admin.PostAsJsonAsync(Root + "/warehouse/openings",
            new StockOpening(Guid.NewGuid(), orgId, storeAId, product.Id, 10m, day, "Звірка А"), Ct))
            .StatusCode.ShouldBe(HttpStatusCode.OK);

        // Link store A to shop and verify draft preview surfaces reservedQuantity.
        (await admin.PutAsJsonAsync(Root + "/warehouse/shop-source/" + product.Id,
            new ConnectWarehouse(orgId, storeAId, null, null, 10m, 10m, 0m), Ct))
            .StatusCode.ShouldBe(HttpStatusCode.OK);

        // Invalid transfer drafts: missing target, same store, or price supplied.
        var noTarget = new StockOperationDraft(Guid.NewGuid(), "transfer", day, orgId, storeAId, null, null, [new(product.Id, 3m, null)]);
        (await admin.PostAsJsonAsync(Root + "/stock-operations", noTarget, Ct)).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var sameStore = noTarget with { Id = Guid.NewGuid(), TargetStoreId = storeAId };
        (await admin.PostAsJsonAsync(Root + "/stock-operations", sameStore, Ct)).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var withPrice = noTarget with { Id = Guid.NewGuid(), TargetStoreId = storeBId, Lines = [new(product.Id, 3m, 10m)] };
        (await admin.PostAsJsonAsync(Root + "/stock-operations", withPrice, Ct)).StatusCode.ShouldBe(HttpStatusCode.BadRequest);

        // Draft delete works on draft and returns 404 after deletion.
        var disposable = new StockOperationDraft(Guid.NewGuid(), "transfer", day, orgId, storeAId, null, "Тимчасова", [new(product.Id, 2m, null)], storeBId);
        (await admin.PostAsJsonAsync(Root + "/stock-operations", disposable, Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await admin.DeleteAsync(Root + "/stock-operations/" + disposable.Id, Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await admin.GetAsync(Root + "/stock-operations/" + disposable.Id, Ct)).StatusCode.ShouldBe(HttpStatusCode.NotFound);

        // Create and post transfer from Store A -> Store B.
        var transferDraft = new StockOperationDraft(Guid.NewGuid(), "transfer", day, orgId, storeAId, null, "На філію", [new(product.Id, 4m, null)], storeBId);
        (await admin.PostAsJsonAsync(Root + "/stock-operations", transferDraft, Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        var state = await admin.ReadAsync<StockOperationState>(Root + "/stock-operations/" + transferDraft.Id);
        state.Number.ShouldStartWith("ПМ-");
        state.TargetStoreId.ShouldBe(storeBId);
        state.TargetStore.ShouldBe(storeB.Title);
        state.Lines.Single().ShouldSatisfyAllConditions(
            l => l.Before.ShouldBe(10m),
            l => l.Change.ShouldBe(-4m),
            l => l.After.ShouldBe(6m),
            l => l.FirstMovement.ShouldBeTrue(),
            l => l.ReservedQuantity.ShouldBe(0m));

        (await admin.PostAsJsonAsync(Root + "/stock-operations/" + transferDraft.Id + "/post",
            new PostStockOperation(state.Revision), Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        // Deleting a posted operation is rejected with 409.
        (await admin.DeleteAsync(Root + "/stock-operations/" + transferDraft.Id, Ct)).StatusCode.ShouldBe(HttpStatusCode.Conflict);

        // Verify both warehouses and synced catalog stock.
        var balanceA = (await admin.ReadAsync<RegisterPage<WarehouseBalance>>(Root + "/warehouse?store=" + storeAId)).Items.Single();
        var balanceB = (await admin.ReadAsync<RegisterPage<WarehouseBalance>>(Root + "/warehouse?store=" + storeBId)).Items.Single();
        balanceA.Quantity.ShouldBe(6m);
        balanceA.ShopQuantity.ShouldBe(6m);
        balanceB.Quantity.ShouldBe(4m);

        // Transfer appears in register=transfer and in BOTH stores' movement histories.
        (await admin.ReadAsync<RegisterPage<DocumentRow>>(Root + "/documents?register=transfer")).Items.ShouldContain(d => d.Id == transferDraft.Id);
        var movesA = await admin.ReadAsync<RegisterPage<WarehouseMovement>>(Root + "/warehouse/" + product.Id + "/movements?org=" + orgId + "&store=" + storeAId);
        var movesB = await admin.ReadAsync<RegisterPage<WarehouseMovement>>(Root + "/warehouse/" + product.Id + "/movements?org=" + orgId + "&store=" + storeBId);
        movesA.Items.ShouldContain(m => m.Kind == "transfer" && m.Change == -4m && m.Balance == 6m);
        movesB.Items.ShouldContain(m => m.Kind == "transfer" && m.Change == 4m && m.Balance == 4m);

        // If Store B writes off 2 units (leaving 2 < 4), unposting the transfer must fail with 409.
        var writeOffB = new StockOperationDraft(Guid.NewGuid(), "writeOff", day, orgId, storeBId, "loss", null, [new(product.Id, 2m, null)]);
        (await admin.PostAsJsonAsync(Root + "/stock-operations", writeOffB, Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        var writeOffState = await admin.ReadAsync<StockOperationState>(Root + "/stock-operations/" + writeOffB.Id);
        (await admin.PostAsJsonAsync(Root + "/stock-operations/" + writeOffB.Id + "/post",
            new PostStockOperation(writeOffState.Revision), Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await admin.PostAsync(Root + "/stock-operations/" + transferDraft.Id + "/unpost", null, Ct)).StatusCode.ShouldBe(HttpStatusCode.Conflict);

        // Unpost the write-off on Store B first, then unpost the transfer cleanly.
        (await admin.PostAsync(Root + "/stock-operations/" + writeOffB.Id + "/unpost", null, Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await admin.PostAsync(Root + "/stock-operations/" + transferDraft.Id + "/unpost", null, Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        // Unpost is idempotent on retry.
        (await admin.PostAsync(Root + "/stock-operations/" + transferDraft.Id + "/unpost", null, Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);

        (await admin.ReadAsync<StockOperationState>(Root + "/stock-operations/" + transferDraft.Id)).Status.ShouldBe("cancelled");
        var restoredA = (await admin.ReadAsync<RegisterPage<WarehouseBalance>>(Root + "/warehouse?store=" + storeAId)).Items.Single();
        var restoredB = (await admin.ReadAsync<RegisterPage<WarehouseBalance>>(Root + "/warehouse?store=" + storeBId)).Items.Single();
        restoredA.Quantity.ShouldBe(10m);
        restoredA.ShopQuantity.ShouldBe(10m);
        restoredB.Quantity.ShouldBe(0m);
        var movesAfterA = await admin.ReadAsync<RegisterPage<WarehouseMovement>>(Root + "/warehouse/" + product.Id + "/movements?org=" + orgId + "&store=" + storeAId);
        movesAfterA.Items.ShouldContain(m => m.Kind == "storno" && m.Change == 4m && m.Balance == 10m);
    }
}

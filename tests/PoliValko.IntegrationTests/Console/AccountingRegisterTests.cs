using System.Net;
using System.Net.Http.Json;
using System.Text;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Domain;
using PoliValko.Console.Features.Accounting;

namespace PoliValko.IntegrationTests;

public sealed class AccountingRegisterTests(ApiFactory api)
{
    private const string Root = "/api/v1/console/accounting";
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Registers_link_imported_documents_and_preserve_exact_native_drafts_on_retry()
    {
        using var admin = await Staff.AdminAsync(api);
        using var manager = await Staff.ManagerAsync(api);
        (await manager.GetAsync(Root + "/partners", Ct)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        var account = "register-" + Guid.NewGuid().ToString("N");
        var source = """
            {"schemaVersion":1,"source":"dntrade","entityType":"invoice","sourceId":"INV","documentType":"in","sourceDate":"2026-11-20","organizationId":"org","total":"12.51","currency":"980","raw":{"partner":{"external_id":"PART","title":"Example"},"organization":{"title":"Register org"},"number":"register-137","products":[{"product":{"title":"Item"},"price":"12.51","quantity":"1","total":"12.51"}]}}
            {"schemaVersion":1,"source":"dntrade","entityType":"partner","sourceId":"part","raw":{"title":"Example"}}
            {"schemaVersion":1,"source":"dntrade","entityType":"store","sourceId":"store","raw":{"title":"Register store"}}
            {"schemaVersion":1,"source":"dntrade","entityType":"cashOrder","sourceId":"settle","documentType":"out","raw":{"parent_document":{"external_id":"inv","type":"in"}}}
            {"schemaVersion":1,"source":"dntrade","entityType":"customerReturn","sourceId":"return-customer","documentType":"back","sourceDate":"2026-04-07","raw":{"number":"register-return-customer"}}
            {"schemaVersion":1,"source":"dntrade","entityType":"invoice","sourceId":"return-supplier","documentType":"back_from_provider","sourceDate":"2026-04-07","raw":{"number":"register-return-supplier"}}
            """;
        var import = await admin.PostAsync("/api/v1/console/dntrade-archive/import?sourceAccount=" + account,
            new StringContent(source, Encoding.UTF8, "application/x-ndjson"), Ct);
        import.StatusCode.ShouldBe(HttpStatusCode.OK);
        var docs = await admin.ReadAsync<RegisterPage<DocumentRow>>(Root + "/documents?register=in&q=register-137");
        var invoice = docs.Items.Single(x => x.SourceAccount == account);
        var returns = await admin.ReadAsync<RegisterPage<DocumentRow>>(Root + "/documents?register=customerReturn&q=register-return&from=2026-04-01&to=2026-04-30");
        returns.Items.Where(x => x.SourceAccount == account).ShouldHaveSingleItem().SourceId.ShouldBe("return-customer");
        invoice.PartnerId.ShouldNotBeNull();
        var card = await admin.ReadAsync<DocumentCard>(Root + "/documents/" + invoice.Id);
        card.Lines.ShouldHaveSingleItem().Total.ShouldBe("12.51");
        card.Related.ShouldHaveSingleItem().SourceId.ShouldBe("settle");
        (await admin.ReadAsync<PartnerCard>(Root + "/partners/" + invoice.PartnerId)).Partner.Title.ShouldBe("Example");
        var newPartner = new NewPartner(Guid.NewGuid(), "Register test native", "individual");
        (await admin.PostAsJsonAsync(Root + "/partners", newPartner, Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        var refs = await admin.ReadAsync<References>(Root + "/references");
        var product = await api.AddProductAsync("ruchnyi-instrument", "Тест реєстру", 12.51m, stock: 2);
        var draft = new NewDraft(Guid.NewGuid(),newPartner.Id,"out","draft-137",new(2026,11,20),
            refs.Organizations.First(x=>x.Title=="Register org").Id,refs.Stores.First(x=>x.Title=="Register store").Id,
            [new(product.Id,1.5m,12.51m)]);
        (await (await admin.PostAsJsonAsync(Root+"/drafts",draft,Ct)).ReadAsync<Guid>()).ShouldBe(draft.Id);
        (await (await admin.PostAsJsonAsync(Root+"/drafts",draft,Ct)).ReadAsync<Guid>()).ShouldBe(draft.Id);
        (await admin.PostAsJsonAsync(Root+"/drafts",draft with { Number="different" },Ct)).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        var saved = await admin.ReadAsync<DocumentCard>(Root + "/documents/" + draft.Id);
        saved.Document.Amount.ShouldBe("18.77");
        saved.Lines.ShouldHaveSingleItem().CatalogId.ShouldBe(product.Id);
        var movements = await admin.ReadAsync<RegisterPage<ProductMovement>>(Root+"/product-history?account=polivalko-native&productRef="+product.Id);
        movements.Items.ShouldHaveSingleItem().Total.ShouldBe("18.77");
        (await admin.ReadAsync<RegisterPage<DocumentRow>>(Root+"/documents?partnerId="+newPartner.Id)).Items.ShouldHaveSingleItem();
        var draftUrl = Root+"/documents/"+draft.Id;
        var emptyStore = await admin.ReadAsync<InvoiceState>(draftUrl+"/operations");
        emptyStore.Stock.Single().After.ShouldBe(-1.5m);
        var confirmation=new PostInvoice(emptyStore.Revision);
        (await admin.PostAsJsonAsync(draftUrl+"/post",confirmation,Ct)).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        var purchase = draft with { Id=Guid.NewGuid(),Kind="in",Number="purchase-137",Lines=[new(product.Id,3m,10m)] };
        await (await admin.PostAsJsonAsync(Root+"/drafts",purchase,Ct)).ReadAsync<Guid>();
        var purchaseUrl=Root+"/documents/"+purchase.Id;
        var initialPurchase=await admin.ReadAsync<InvoiceState>(purchaseUrl+"/operations");
        var edit=new DraftChange(initialPurchase.Revision,purchase with { Number="corrected-137" });
        (await admin.PutAsJsonAsync(Root+"/drafts/"+purchase.Id,edit,Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await admin.PostAsJsonAsync(purchaseUrl+"/post",new PostInvoice(initialPurchase.Revision),Ct)).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        var receiptConfirmation=new PostInvoice((await admin.ReadAsync<InvoiceState>(purchaseUrl+"/operations")).Revision);
        var posts=await Task.WhenAll(admin.PostAsJsonAsync(purchaseUrl+"/post",receiptConfirmation,Ct),admin.PostAsJsonAsync(purchaseUrl+"/post",receiptConfirmation,Ct));
        posts.ShouldAllBe(p=>p.StatusCode==HttpStatusCode.OK);
        (await admin.ReadAsync<InvoiceState>(purchaseUrl+"/operations")).Stock.Single().After.ShouldBe(3m);
        (await (await admin.PostAsJsonAsync(draftUrl+"/post",confirmation,Ct)).ReadAsync<Guid>()).ShouldBe(draft.Id);
        var payment=new InvoicePayment(Guid.NewGuid(),draft.Day,10m,"cash","Каса","137-1");
        var pays=await Task.WhenAll(admin.PostAsJsonAsync(draftUrl+"/payments",payment,Ct),admin.PostAsJsonAsync(draftUrl+"/payments",payment,Ct));
        pays.ShouldAllBe(p=>p.StatusCode==HttpStatusCode.OK);
        var state=await admin.ReadAsync<InvoiceState>(draftUrl+"/operations");
        state.Stock.Single().After.ShouldBe(1.5m);
        state.Payments.Count.ShouldBe(1);
        state.Due.ShouldBe("8.77");
        (await admin.PostAsJsonAsync(draftUrl+"/payments",payment with {Id=Guid.NewGuid()},Ct)).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        var partial=await admin.ReadAsync<RegisterPage<DocumentRow>>(Root+"/documents?queue=receivable&partnerId="+newPartner.Id);
        partial.Items.Single().PaymentStatus.ShouldBe("partial");
        var position=await admin.ReadAsync<List<PartnerPosition>>(Root+"/partners/"+newPartner.Id+"/positions");
        position.Single().Receivable.ShouldBe("8.77");
        decimal.Parse(position.Single().Payable,System.Globalization.CultureInfo.InvariantCulture).ShouldBe(30m);
        var closingPayment = new { id=Guid.NewGuid(),day=draft.Day,amount="8.77",method="bank",accountTitle="Рахунок",reference="137-2" };
        (await admin.PostAsJsonAsync(draftUrl+"/payments",closingPayment,Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        var settled=await admin.ReadAsync<RegisterPage<DocumentRow>>(Root+"/documents?queue=settled&partnerId="+newPartner.Id);
        settled.Items.Single().Id.ShouldBe(draft.Id);
        (await admin.ReadAsync<InvoiceState>(draftUrl+"/operations")).Due.ShouldBe("0.00");
        var stock=await admin.ReadAsync<RegisterPage<WarehouseBalance>>(Root+"/warehouse?store="+draft.StoreId);
        stock.Items.Single(s=>s.ProductId==product.Id).Quantity.ShouldBe(1.5m);
        var opening=new StockOpening(Guid.NewGuid(),Guid.Parse(draft.OrganizationId),Guid.Parse(draft.StoreId),product.Id,12.5m,draft.Day,"inventory-137");
        (await admin.PostAsJsonAsync(Root+"/warehouse/openings",opening,Ct)).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        var counted=await api.AddProductAsync("ruchnyi-instrument", "Інвентаризація 137", 1m,stock:0);
        opening=opening with { ProductId=counted.Id };
        (await admin.PostAsJsonAsync(Root+"/warehouse/openings",opening,Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await admin.PostAsJsonAsync(Root+"/warehouse/openings",opening,Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await admin.ReadAsync<RegisterPage<WarehouseBalance>>(Root+"/warehouse?store="+draft.StoreId)).Items.Single(s=>s.ProductId==counted.Id).Opening.ShouldBe(12.5m);
        using var clerk=await TestRoles.LoginWithPermissionsAsync(api,admin,PoliValko.Infrastructure.Security.Permissions.PermissionKeys.AccountingView);
        (await clerk.PostAsJsonAsync(draftUrl+"/post",confirmation,Ct)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await clerk.PostAsJsonAsync(draftUrl+"/payments",payment,Ct)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }

    private sealed record References(List<RegisterReference> Organizations,List<RegisterReference> Stores);

    [Fact]
    public async Task Renamed_partners_keep_matching_report_rows_and_link_in_bulk()
    {
        using var admin = await Staff.AdminAsync(api);
        var account = "names-" + Guid.NewGuid().ToString("N");
        object Row(string section,string? level,params string[] values) =>
            new { section,level,cells=values.Select(value=>new { value }) };
        var report = new { schemaVersion=1,source="dntrade",entityType="financialReport",sourceId="names-report",sourceDate="2026-11-20",
            documentType="Взаєморозрахунки з контрагентами",raw=new { tables=new[] { new[] {
                Row("TBODY",null," Іван (Шашлики)","","","",""),Row("TBODY","indent","Main","0,00 грн.","10,00 грн.","0,00 грн.","-10,00 грн."),
                Row("TBODY",null,"Петро","","","",""),Row("TBODY","indent","Main","0,00 грн.","5,00 грн.","0,00 грн.","-5,00 грн."),
                Row("TBODY","indent","Main","0,00 грн.","7,00 грн.","0,00 грн.","-7,00 грн."),
                Row("TFOOT",null,"Разом","0,00 грн.","22,00 грн.","0,00 грн.","-22,00 грн.")
            } } } };
        object Partner(string id,string title) => new { schemaVersion=1,source="dntrade",entityType="partner",sourceId=id,raw=new { title } };
        var invoice = new { schemaVersion=1,source="dntrade",entityType="invoice",sourceId="names-invoice",documentType="in",sourceDate="2026-11-20",organizationId="org-names",
            raw=new { number="names-1",organization=new { title="Org "+account },partner=new { external_id="p1",title=" Іван (Шашлики)" } } };
        var body = string.Join("\n",new[]{report,Partner("p1"," Іван (Шашлики)"),Partner("p2","Петро"),Partner("p3","Петро"),invoice}
            .Select(x=>System.Text.Json.JsonSerializer.Serialize(x)));
        (await admin.PostAsync("/api/v1/console/dntrade-archive/import?sourceAccount="+account,
            new StringContent(body,Encoding.UTF8,"application/x-ndjson"),Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        var partner = (await admin.ReadAsync<RegisterPage<PartnerRow>>(Root+"/partners?q=шашлики")).Items.Single(p=>p.SourceAccount==account);

        var rename = new PartnerNameChange(partner.Id,"Іван","Шашлики",partner.Title,null);
        var changes = new PartnerNameChanges([rename]);
        (await (await admin.PostAsJsonAsync(Root+"/partners/names",changes,Ct)).ReadAsync<int>()).ShouldBe(1);
        (await (await admin.PostAsJsonAsync(Root+"/partners/names",changes,Ct)).ReadAsync<int>()).ShouldBe(0);
        (await admin.PostAsJsonAsync(Root+"/partners/names",new PartnerNameChanges([rename with {Title="Інший"}]),Ct))
            .StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await admin.PostAsJsonAsync(Root+"/partners/names",new PartnerNameChanges([rename with {Title=" "}]),Ct))
            .StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var renamed = (await admin.ReadAsync<RegisterPage<PartnerRow>>(Root+"/partners?q=шашлики")).Items.Single(p=>p.Id==partner.Id);
        renamed.Title.ShouldBe("Іван");
        renamed.Note.ShouldBe("Шашлики");
        renamed.SourceTitle.ShouldBe(" Іван (Шашлики)");
        (await admin.ReadAsync<RegisterPage<DocumentRow>>(Root+"/documents?partnerId="+partner.Id)).Items.Single().PartnerTitle.ShouldBe("Іван");

        var reportId = (await admin.ReadAsync<List<BalanceReport>>(Root+"/balance-reports")).Single(r=>r.SourceAccount==account).Id;
        var url = Root+"/balance-reports/"+reportId;
        var rows = await admin.ReadAsync<List<BalanceRow>>(url);
        rows[0].Candidate.ShouldBe(partner.Id);
        rows[0].PartnerName.ShouldBe("Іван");
        rows[1].CandidateCount.ShouldBe(2);
        using var clerk = await TestRoles.LoginWithPermissionsAsync(api,admin,PoliValko.Infrastructure.Security.Permissions.PermissionKeys.AccountingView);
        (await clerk.PostAsync(url+"/partner-links",null,Ct)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await clerk.PostAsJsonAsync(Root+"/partners/names",changes,Ct)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await (await admin.PostAsync(url+"/partner-links",null,Ct)).ReadAsync<int>()).ShouldBe(1);
        (await (await admin.PostAsync(url+"/partner-links",null,Ct)).ReadAsync<int>()).ShouldBe(0);
        rows = await admin.ReadAsync<List<BalanceRow>>(url);
        rows[0].LinkedPartner.ShouldBe(partner.Id);
        rows[1].LinkedPartner.ShouldBeNull();
        rows.Single(r=>r.Footer).LinkedPartner.ShouldBeNull();

        // One heading can hold rows of different same-named partners; each row links on its own.
        var namesakes = (await admin.ReadAsync<RegisterPage<PartnerRow>>(Root+"/partners?q=петро")).Items
            .Where(p=>p.SourceAccount==account).OrderBy(p=>p.SourceId).ToList();
        var rowUrl = url+"/rows/"+rows[2].Position+"/partner";
        (await clerk.PutAsJsonAsync(rowUrl,new BalanceRowLink(namesakes[1].Id,null),Ct)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await admin.PutAsJsonAsync(rowUrl,new BalanceRowLink(namesakes[1].Id,null),Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await admin.PutAsJsonAsync(rowUrl,new BalanceRowLink(namesakes[1].Id,null),Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await admin.PutAsJsonAsync(rowUrl,new BalanceRowLink(namesakes[0].Id,null),Ct)).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await admin.PutAsJsonAsync(url+"/rows/"+rows[1].Position+"/partner",new BalanceRowLink(namesakes[0].Id,null),Ct))
            .StatusCode.ShouldBe(HttpStatusCode.OK);
        (await admin.PutAsJsonAsync(url+"/rows/"+rows.Single(r=>r.Footer).Position+"/partner",new BalanceRowLink(namesakes[0].Id,null),Ct))
            .StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        rows = await admin.ReadAsync<List<BalanceRow>>(url);
        rows[1].LinkedPartner.ShouldBe(namesakes[0].Id);
        rows[1].RowLinked.ShouldBeTrue();
        rows[2].LinkedPartner.ShouldBe(namesakes[1].Id);
        rows[2].PartnerName.ShouldBe("Петро");
        rows[0].RowLinked.ShouldBeFalse();

        var org = (await admin.ReadAsync<References>(Root+"/references")).Organizations.Single(x=>x.Title=="Org "+account);
        var opening = new ConfirmOpening(rows[2].Position,namesakes[1].Id,Guid.Parse(org.Id),"payable",rows[2].Closing!);
        (await admin.PostAsJsonAsync(url+"/openings",opening with {PartnerId=namesakes[0].Id},Ct)).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await admin.PostAsJsonAsync(url+"/openings",opening,Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await admin.PutAsJsonAsync(rowUrl,new BalanceRowLink(namesakes[0].Id,namesakes[1].Id),Ct)).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await admin.ReadAsync<List<PartnerOpening>>(Root+"/partners/"+namesakes[1].Id+"/openings")).Single().Amount.ShouldBe("7.00");
    }

    [Fact]
    public async Task Merged_duplicate_moves_its_debts_and_documents_to_the_main_card_and_can_be_undone()
    {
        using var admin = await Staff.AdminAsync(api);
        var account = "merge-" + Guid.NewGuid().ToString("N");
        object Row(string section,string? level,params string[] values) =>
            new { section,level,cells=values.Select(value=>new { value }) };
        var report = new { schemaVersion=1,source="dntrade",entityType="financialReport",sourceId="merge-report",sourceDate="2026-11-20",
            documentType="Взаєморозрахунки з контрагентами",raw=new { tables=new[] { new[] {
                Row("TBODY",null,"ТОВ \"Тест\"","","","",""),Row("TBODY","indent","Main","0,00 грн.","10,00 грн.","0,00 грн.","-10,00 грн."),
                Row("TBODY",null,"ТОВ Тест","","","",""),Row("TBODY","indent","Main","0,00 грн.","20,00 грн.","0,00 грн.","-20,00 грн.")
            } } } };
        object Partner(string id,string title) => new { schemaVersion=1,source="dntrade",entityType="partner",sourceId=id,raw=new { title } };
        object Invoice(string id,string partner) => new { schemaVersion=1,source="dntrade",entityType="invoice",sourceId=id,documentType="in",
            sourceDate="2026-11-20",organizationId="org-merge",raw=new { number=id,organization=new { title="Org "+account },partner=new { external_id=partner } } };
        var body = string.Join("\n",new[]{report,Partner("m1","ТОВ \"Тест\""),Partner("m2","ТОВ Тест"),Invoice("inv-1","m1"),Invoice("inv-2","m2")}
            .Select(x=>System.Text.Json.JsonSerializer.Serialize(x)));
        (await admin.PostAsync("/api/v1/console/dntrade-archive/import?sourceAccount="+account,
            new StringContent(body,Encoding.UTF8,"application/x-ndjson"),Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        var cards = (await admin.ReadAsync<RegisterPage<PartnerRow>>(Root+"/partners?q=тест")).Items
            .Where(p=>p.SourceAccount==account).OrderBy(p=>p.SourceId).ToList();
        var (main,duplicate) = (cards[0].Id,cards[1].Id);
        var reportId = (await admin.ReadAsync<List<BalanceReport>>(Root+"/balance-reports")).Single(r=>r.SourceAccount==account).Id;
        var url = Root+"/balance-reports/"+reportId;
        (await (await admin.PostAsync(url+"/partner-links",null,Ct)).ReadAsync<int>()).ShouldBe(2);
        var rows = await admin.ReadAsync<List<BalanceRow>>(url);
        var org = (await admin.ReadAsync<References>(Root+"/references")).Organizations.Single(x=>x.Title=="Org "+account);
        (await admin.PostAsJsonAsync(url+"/openings",new ConfirmOpening(rows[1].Position,duplicate,Guid.Parse(org.Id),"payable",rows[1].Closing!),Ct))
            .StatusCode.ShouldBe(HttpStatusCode.OK);
        async Task<int> Documents(Guid id) => (await admin.ReadAsync<RegisterPage<DocumentRow>>(Root+"/documents?partnerId="+id)).Total;
        async Task<List<CurrentPartnerBalance>> Debts() =>
            (await admin.ReadAsync<RegisterPage<CurrentPartnerBalance>>(Root+"/current-balances?org="+org.Id)).Items;

        using var clerk = await TestRoles.LoginWithPermissionsAsync(api,admin,PoliValko.Infrastructure.Security.Permissions.PermissionKeys.AccountingView);
        (await clerk.PostAsJsonAsync(Root+"/partners/"+main+"/merge",new PartnerMerge([duplicate]),Ct)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await admin.PostAsJsonAsync(Root+"/partners/"+main+"/merge",new PartnerMerge([main]),Ct)).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await (await admin.PostAsJsonAsync(Root+"/partners/"+main+"/merge",new PartnerMerge([duplicate]),Ct)).ReadAsync<int>()).ShouldBe(1);
        (await admin.PostAsJsonAsync(Root+"/partners/"+duplicate+"/merge",new PartnerMerge([main]),Ct)).StatusCode.ShouldBe(HttpStatusCode.Conflict);

        (await admin.ReadAsync<RegisterPage<PartnerRow>>(Root+"/partners?q=тест")).Items.Where(p=>p.SourceAccount==account)
            .Select(p=>p.Id).ToArray().ShouldBe(new[]{main});
        var card = await admin.ReadAsync<PartnerCard>(Root+"/partners/"+main);
        card.Merged.Single().Id.ShouldBe(duplicate);
        (await admin.ReadAsync<PartnerCard>(Root+"/partners/"+duplicate)).Partner.MergedInto.ShouldBe(main);
        (await Documents(main)).ShouldBe(2);
        (await Documents(duplicate)).ShouldBe(0);
        (await Debts()).Single().ShouldSatisfyAllConditions(d=>d.PartnerId.ShouldBe(main),d=>d.Payable.ShouldBe("20.00"));
        rows = await admin.ReadAsync<List<BalanceRow>>(url);
        rows.ShouldAllBe(r=>r.LinkedPartner==main);
        (await admin.PutAsJsonAsync(url+"/rows/"+rows[1].Position+"/partner",new BalanceRowLink(duplicate,null),Ct))
            .StatusCode.ShouldBe(HttpStatusCode.BadRequest);

        (await admin.PostAsync(Root+"/partners/"+main+"/unmerge",null,Ct)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await (await admin.PostAsync(Root+"/partners/"+duplicate+"/unmerge",null,Ct)).ReadAsync<Guid>()).ShouldBe(main);
        (await Documents(main)).ShouldBe(1);
        (await Documents(duplicate)).ShouldBe(1);
        (await Debts()).Single().PartnerId.ShouldBe(duplicate);
        rows = await admin.ReadAsync<List<BalanceRow>>(url);
        rows[0].LinkedPartner.ShouldBe(main);
        rows[1].LinkedPartner.ShouldBe(duplicate);
        (await admin.ReadAsync<RegisterPage<PartnerRow>>(Root+"/partners?q=тест")).Items.Count(p=>p.SourceAccount==account).ShouldBe(2);

        // Namesakes confirmed as different partners are no longer offered for a merge.
        var pair = new DistinctPartners([duplicate,main]);
        (await clerk.PostAsJsonAsync(Root+"/partners/distinct",pair,Ct)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await (await admin.PostAsJsonAsync(Root+"/partners/distinct",pair,Ct)).ReadAsync<int>()).ShouldBe(1);
        (await (await admin.PostAsJsonAsync(Root+"/partners/distinct",pair,Ct)).ReadAsync<int>()).ShouldBe(0);
        (await admin.ReadAsync<List<DistinctPair>>(Root+"/partners/distinct"))
            .ShouldContain(p=>(p.FirstId==main && p.SecondId==duplicate) || (p.FirstId==duplicate && p.SecondId==main));
        (await admin.ReadAsync<PartnerCard>(Root+"/partners/"+main)).DistinctFrom.Single().Id.ShouldBe(duplicate);
        (await admin.PostAsJsonAsync(Root+"/partners/"+main+"/merge",new PartnerMerge([duplicate]),Ct)).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await (await admin.PostAsJsonAsync(Root+"/partners/distinct/remove",pair,Ct)).ReadAsync<int>()).ShouldBe(1);
        (await admin.ReadAsync<PartnerCard>(Root+"/partners/"+main)).DistinctFrom.ShouldBeEmpty();
    }

    [Fact]
    public async Task Settlement_keeps_unmarked_currency_and_requires_an_explicit_partner_link()
    {
        using var admin = await Staff.AdminAsync(api);
        var account = "balances-" + Guid.NewGuid().ToString("N");
        object Row(string section,string? level,params string[] values) =>
            new { section,level,cells=values.Select(value=>new { value }) };
        var report = new { schemaVersion=1,source="dntrade",entityType="financialReport",sourceId="balances-test",sourceDate="2026-11-20",
            documentType="Взаєморозрахунки з контрагентами",raw=new { tables=new[] { new[] {
                Row("TBODY",null,"Example","","","",""),Row("TBODY","indent","UAH","0,00 грн.","123,45 грн.","0,00 грн.","-123,46 грн."),
                Row("TBODY","indent","Other","0,00","223,00","223,00","0,00"),
                Row("TBODY","indent","Main","0,00 грн.","123,45 грн.","0,00 грн.","-123,45 грн.")
            } } } };
        var partner = new { schemaVersion=1,source="dntrade",entityType="partner",sourceId="partner",raw=new { title="Example" } };
        var secondReport=report with {sourceId="balances-second"};
        var orgInvoice=new {schemaVersion=1,source="dntrade",entityType="invoice",sourceId="orgdoc",documentType="in",organizationId="org-settle",raw=new { organization=new {title="Org "+account}}};
        var store=new {schemaVersion=1,source="dntrade",entityType="store",sourceId="store",raw=new {title="Store "+account}};
        var body = string.Join("\n",new object[]{report,secondReport,partner,orgInvoice,store}.Select(x=>System.Text.Json.JsonSerializer.Serialize(x)));
        (await admin.PostAsync("/api/v1/console/dntrade-archive/import?sourceAccount="+account,
            new StringContent(body,Encoding.UTF8,"application/x-ndjson"),Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        var list = await admin.ReadAsync<List<BalanceReport>>(Root+"/balance-reports");
        var reportId = list.Single(r=>r.SourceAccount==account && r.SourceId==report.sourceId).Id;
        var url = Root+"/balance-reports/"+reportId;
        var rows = await admin.ReadAsync<List<BalanceRow>>(url);
        rows[0].Difference.ShouldBe("-0.01");
        rows[1].Incoming.ShouldBeNull();
        rows[1].SourceAmounts[1].ShouldBe("223,00");
        rows[0].LinkedPartner.ShouldBeNull();
        rows[0].CandidateCount.ShouldBe(1);
        var link = new BalancePartnerLink(rows[0].HeadingPosition!.Value,rows[0].Candidate!.Value,null);
        (await admin.PutAsJsonAsync(url+"/partner",link,Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await admin.ReadAsync<List<BalanceRow>>(url)).ShouldAllBe(r=>r.LinkedPartner==link.PartnerId);
        var org=(await admin.ReadAsync<References>(Root+"/references")).Organizations.Single(x=>x.Title=="Org "+account);
        var input=new ConfirmOpening(rows[2].Position,link.PartnerId,Guid.Parse(org.Id),"payable",rows[2].Closing!);
        using var clerk=await TestRoles.LoginWithPermissionsAsync(api,admin,PoliValko.Infrastructure.Security.Permissions.PermissionKeys.AccountingView);
        (await clerk.PostAsJsonAsync(url+"/openings",input,Ct)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await admin.PostAsJsonAsync(url+"/openings",input with {Position=rows[0].Position,Closing=rows[0].Closing!},Ct)).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await admin.PostAsJsonAsync(url+"/openings",input with {Position=rows[1].Position},Ct)).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        var results=await Task.WhenAll(admin.PostAsJsonAsync(url+"/openings",input,Ct),admin.PostAsJsonAsync(url+"/openings",input,Ct));
        var opening=await results[0].ReadAsync<Guid>();
        (await results[1].ReadAsync<Guid>()).ShouldBe(opening);
        (await admin.PostAsJsonAsync(url+"/openings",input with {Direction="receivable"},Ct)).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        var secondUrl=Root+"/balance-reports/"+list.Single(r=>r.SourceAccount==account && r.SourceId==secondReport.sourceId).Id;
        (await admin.PutAsJsonAsync(secondUrl+"/partner",link,Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await admin.PostAsJsonAsync(secondUrl+"/openings",input,Ct)).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        var partnerUrl=Root+"/partners/"+link.PartnerId;
        (await admin.ReadAsync<List<PartnerOpening>>(partnerUrl+"/openings")).Single().Amount.ShouldBe("123.45");
        var payUrl=Root+"/openings/"+opening+"/payments";
        var pay=new InvoicePayment(Guid.NewGuid(),new(2026,11,20),23.46m,"bank","Test bank","Legacy 1");
        (await admin.PostAsJsonAsync(payUrl,pay with {Day=new(2026,11,19)},Ct)).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        var payments=await Task.WhenAll(admin.PostAsJsonAsync(payUrl,pay,Ct),admin.PostAsJsonAsync(payUrl,pay,Ct));
        payments.ShouldAllBe(p=>p.StatusCode==HttpStatusCode.OK);
        (await admin.ReadAsync<List<RecordedPayment>>(payUrl)).Single().Amount.ShouldBe("23.46");
        (await admin.ReadAsync<List<PartnerPosition>>(partnerUrl+"/positions")).Single().Payable.ShouldBe("99.99");
        (await admin.PostAsJsonAsync(payUrl,pay with {Id=Guid.NewGuid(),Amount=100m},Ct)).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        var otherPartner=new NewPartner(Guid.NewGuid(),"Another "+account,"individual");
        (await admin.PostAsJsonAsync(Root+"/partners",otherPartner,Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await admin.PutAsJsonAsync(url+"/partner",link with {Previous=link.PartnerId,PartnerId=otherPartner.Id},Ct)).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        var item=await api.AddProductAsync("ruchnyi-instrument","Тест початкового боргу",10.01m,stock:0);
        var storeId=(await admin.ReadAsync<References>(Root+"/references")).Stores.Single(s=>s.Title==store.raw.title).Id;
        var purchase=new NewDraft(Guid.NewGuid(),link.PartnerId,"in","new-1",pay.Day,org.Id,storeId,[new(item.Id,1m,10.01m)]);
        (await admin.PostAsJsonAsync(Root+"/drafts",purchase,Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        var docUrl=Root+"/documents/"+purchase.Id;
        var revision=(await admin.ReadAsync<InvoiceState>(docUrl+"/operations")).Revision;
        (await admin.PostAsJsonAsync(docUrl+"/post",new PostInvoice(revision),Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        var filtered=Root+"/current-balances?org="+org.Id+"&q=Example&direction=";
        (await admin.ReadAsync<RegisterPage<CurrentPartnerBalance>>(filtered+"payable")).Items.Single().Payable.ShouldBe("110.00");
        (await admin.ReadAsync<RegisterPage<CurrentPartnerBalance>>(filtered+"receivable")).Total.ShouldBe(0);
        (await admin.ReadAsync<List<PartnerPosition>>(partnerUrl+"/positions")).Single().Payable.ShouldBe("110.00");
    }

    [Fact]
    public async Task Native_references_customer_returns_draft_deletion_payment_reversal_and_unpost_work_end_to_end()
    {
        using var admin = await Staff.AdminAsync(api);
        using var viewer = await TestRoles.LoginWithPermissionsAsync(api, admin, PoliValko.Infrastructure.Security.Permissions.PermissionKeys.AccountingView);
        var suffix = Guid.NewGuid().ToString("N")[..8];

        // Organizations & Stores CRUD
        (await viewer.PostAsJsonAsync(Root + "/references/organizations", new ReferenceRequest("NoPerm " + suffix), Ct))
            .StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        var org = await (await admin.PostAsJsonAsync(Root + "/references/organizations",
            new ReferenceRequest("ФОП Новий " + suffix), Ct)).ReadAsync<RegisterReference>();
        var store = await (await admin.PostAsJsonAsync(Root + "/references/stores",
            new ReferenceRequest("Склад Новий " + suffix), Ct)).ReadAsync<RegisterReference>();
        (await admin.PostAsJsonAsync(Root + "/references/organizations",
            new ReferenceRequest("ФОП Новий " + suffix), Ct)).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        var renamedOrg = await (await admin.PutAsJsonAsync(Root + "/references/organizations/" + org.Id,
            new RenameReferenceRequest("ФОП Оновлений " + suffix), Ct)).ReadAsync<RegisterReference>();
        renamedOrg.Title.ShouldBe("ФОП Оновлений " + suffix);
        var renamedStore = await (await admin.PutAsJsonAsync(Root + "/references/stores/" + store.Id,
            new RenameReferenceRequest("Склад Оновлений " + suffix), Ct)).ReadAsync<RegisterReference>();
        renamedStore.Title.ShouldBe("Склад Оновлений " + suffix);
        var refs = await admin.ReadAsync<References>(Root + "/references");
        refs.Organizations.ShouldContain(o => o.Id == org.Id && o.Title == renamedOrg.Title);
        refs.Stores.ShouldContain(s => s.Id == store.Id && s.Title == renamedStore.Title);

        var partner = new NewPartner(Guid.NewGuid(), "Покупець повернення " + suffix, "individual");
        (await admin.PostAsJsonAsync(Root + "/partners", partner, Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        var product = await api.AddProductAsync("ruchnyi-instrument", "Товар повернення " + suffix, 200m, stock: 0);
        var day = new DateOnly(2026, 11, 23);

        // Draft deletion on draft vs posted
        var disposable = new NewDraft(Guid.NewGuid(), partner.Id, "customerReturn", "RET-DEL-" + suffix, day,
            org.Id, store.Id, [new(product.Id, 1m, 200m)]);
        (await admin.PostAsJsonAsync(Root + "/drafts", disposable, Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await viewer.DeleteAsync(Root + "/drafts/" + disposable.Id, Ct)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await admin.DeleteAsync(Root + "/drafts/" + disposable.Id, Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await admin.GetAsync(Root + "/documents/" + disposable.Id, Ct)).StatusCode.ShouldBe(HttpStatusCode.NotFound);

        // Native customerReturn draft -> preview shows firstMovement -> post adds +qty & tracks payable credit
        var ret = new NewDraft(Guid.NewGuid(), partner.Id, "customerReturn", "RET-" + suffix, day,
            org.Id, store.Id, [new(product.Id, 2m, 200m)]);
        (await admin.PostAsJsonAsync(Root + "/drafts", ret, Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        var retUrl = Root + "/documents/" + ret.Id;
        var preview = await admin.ReadAsync<InvoiceState>(retUrl + "/operations");
        preview.Stock.Single().ShouldSatisfyAllConditions(
            s => s.Before.ShouldBe(0m),
            s => s.Change.ShouldBe(2m),
            s => s.After.ShouldBe(2m),
            s => s.FirstMovement.ShouldBeTrue());

        (await admin.PostAsJsonAsync(retUrl + "/post", new PostInvoice(preview.Revision), Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await admin.DeleteAsync(Root + "/drafts/" + ret.Id, Ct)).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await admin.ReadAsync<RegisterPage<DocumentRow>>(Root + "/documents?register=customerReturn&q=" + ret.Number))
            .Items.ShouldContain(d => d.Id == ret.Id);
        (await admin.ReadAsync<RegisterPage<WarehouseBalance>>(Root + "/warehouse?store=" + store.Id))
            .Items.Single(w => w.ProductId == product.Id).Quantity.ShouldBe(2m);

        // Record payout to customer, verify due drops, verify unpost is blocked while payment exists
        var payment = new InvoicePayment(Guid.NewGuid(), day, 150m, "cash", "Каса", "PAY-" + suffix);
        (await admin.PostAsJsonAsync(retUrl + "/payments", payment, Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await admin.ReadAsync<InvoiceState>(retUrl + "/operations")).ShouldSatisfyAllConditions(
            s => s.Paid.ShouldBe("150.00"),
            s => s.Due.ShouldBe("250.00"));
        (await admin.PostAsync(retUrl + "/unpost", null, Ct)).StatusCode.ShouldBe(HttpStatusCode.Conflict);

        // Delete payment (requires AccountingPost), verify due restores to 400.00
        (await viewer.DeleteAsync(Root + "/payments/" + payment.Id, Ct)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await admin.DeleteAsync(Root + "/payments/" + payment.Id, Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await admin.DeleteAsync(Root + "/payments/" + payment.Id, Ct)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await admin.ReadAsync<InvoiceState>(retUrl + "/operations")).ShouldSatisfyAllConditions(
            s => s.Paid.ShouldBe("0.00"),
            s => s.Due.ShouldBe("400.00"),
            s => s.Payments.ShouldBeEmpty());

        // Now unpost succeeds, reverses +2 back to 0, sets status to cancelled, removes from balances
        (await viewer.PostAsync(retUrl + "/unpost", null, Ct)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await admin.PostAsync(retUrl + "/unpost", null, Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await admin.PostAsync(retUrl + "/unpost", null, Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await admin.ReadAsync<InvoiceState>(retUrl + "/operations")).ShouldSatisfyAllConditions(
            s => s.Status.ShouldBe("cancelled"),
            s => s.Due.ShouldBeNull());
        (await admin.ReadAsync<RegisterPage<WarehouseBalance>>(Root + "/warehouse?store=" + store.Id))
            .Items.Single(w => w.ProductId == product.Id).Quantity.ShouldBe(0m);
    }

    [Fact]
    public async Task Archived_products_are_rejected_in_openings_drafts_stock_operations_and_posting()
    {
        using var admin = await Staff.AdminAsync(api);
        var suffix = Guid.NewGuid().ToString("N")[..8];
        var org = await (await admin.PostAsJsonAsync(Root + "/references/organizations",
            new ReferenceRequest("ФОП Архів " + suffix), Ct)).ReadAsync<RegisterReference>();
        var store = await (await admin.PostAsJsonAsync(Root + "/references/stores",
            new ReferenceRequest("Склад Архів " + suffix), Ct)).ReadAsync<RegisterReference>();
        var partner = new NewPartner(Guid.NewGuid(), "Контрагент Архів " + suffix, "individual");
        (await admin.PostAsJsonAsync(Root + "/partners", partner, Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        var day = new DateOnly(2026, 11, 24);

        var archived = await api.AddProductAsync("ruchnyi-instrument", "Архівний товар " + suffix, 100m, stock: 0);
        await api.WithDbAsync(db => db.Set<Product>().Where(p => p.Id == archived.Id)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.IsArchived, true), Ct));

        (await admin.PostAsJsonAsync(Root + "/warehouse/openings",
            new StockOpening(Guid.NewGuid(), Guid.Parse(org.Id), Guid.Parse(store.Id), archived.Id, 5m, day, "arch-open-" + suffix), Ct))
            .StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await admin.PostAsJsonAsync(Root + "/drafts",
            new NewDraft(Guid.NewGuid(), partner.Id, "in", "ARCH-IN-" + suffix, day, org.Id, store.Id, [new(archived.Id, 1m, 100m)]), Ct))
            .StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await admin.PostAsJsonAsync(Root + "/stock-operations",
            new StockOperationDraft(Guid.NewGuid(), "income", day, Guid.Parse(org.Id), Guid.Parse(store.Id), null, null, [new(archived.Id, 1m, 100m)]), Ct))
            .StatusCode.ShouldBe(HttpStatusCode.BadRequest);

        // Archiving a product after draft creation must also block posting.
        var laterArchived = await api.AddProductAsync("ruchnyi-instrument", "Архівований після чернетки " + suffix, 100m, stock: 0);
        var invoiceDraft = new NewDraft(Guid.NewGuid(), partner.Id, "in", "ARCH-POST-" + suffix, day, org.Id, store.Id, [new(laterArchived.Id, 1m, 100m)]);
        (await admin.PostAsJsonAsync(Root + "/drafts", invoiceDraft, Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        var invoiceRev = (await admin.ReadAsync<InvoiceState>(Root + "/documents/" + invoiceDraft.Id + "/operations")).Revision;

        var stockDraft = new StockOperationDraft(Guid.NewGuid(), "income", day, Guid.Parse(org.Id), Guid.Parse(store.Id), null, null, [new(laterArchived.Id, 1m, 100m)]);
        (await admin.PostAsJsonAsync(Root + "/stock-operations", stockDraft, Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        var stockRev = (await admin.ReadAsync<StockOperationState>(Root + "/stock-operations/" + stockDraft.Id)).Revision;

        await api.WithDbAsync(db => db.Set<Product>().Where(p => p.Id == laterArchived.Id)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.IsArchived, true), Ct));

        (await admin.PostAsJsonAsync(Root + "/documents/" + invoiceDraft.Id + "/post", new PostInvoice(invoiceRev), Ct))
            .StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await admin.PostAsJsonAsync(Root + "/stock-operations/" + stockDraft.Id + "/post", new PostStockOperation(stockRev), Ct))
            .StatusCode.ShouldBe(HttpStatusCode.Conflict);
    }
}

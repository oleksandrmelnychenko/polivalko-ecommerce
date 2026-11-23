using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Domain;
using PoliValko.Console.Features.Accounting;

namespace PoliValko.IntegrationTests;

public sealed class InventoryReviewTests(ApiFactory api)
{
    private const string Root="/api/v1/console/accounting";
    private static CancellationToken Ct=>TestContext.Current.CancellationToken;
    private sealed record References(List<RegisterReference> Organizations,List<RegisterReference> Stores);

    [Fact]
    public async Task Multipart_stock_requires_complete_unique_rows_and_agreeing_source_quantities()
    {
        using var admin=await Staff.AdminAsync(api);
        var source=Guid.NewGuid().ToString("N");
        var store=Guid.NewGuid().ToString();
        var codes=new[]{source+"1",source+"2",source+"3"};
        foreach (var code in codes)
        {
            var p=await api.AddProductAsync("ruchnyi-instrument",code,1);
            await api.WithDbAsync(db=>db.Set<Product>().Where(x=>x.Id==p.Id).ExecuteUpdateAsync(s=>s.SetProperty(x=>x.NavkoloId,"dntrade-code:"+code),Ct));
        }
        object Row(string section,params string[] values)=>new {section,cells=values.Select(value=>new {value})};
        object Part(int first,params (string Code,string Qty,int RawQty,int Booked)[] lines)
        {
            var rows=new List<object>{Row("THEAD","Код","Артикул","Назва","Залишок","Заброньовано","UUID товару")};
            rows.AddRange(lines.Select(l=>Row("TBODY",l.Code,l.Code,l.Code,l.Qty,l.Booked.ToString(),l.Code)));
            return new {schemaVersion=1,source="dntrade",sourceId=source+"-part-"+first,entityType="inventorySnapshot",sourceDate="2026-11-20",
                raw=new {firstRow=first,rowCount=lines.Length,reportRowCount=3,capturedAtUtc="2026-11-20T12:12:41Z",
                    warehouse=new {id=store,title=source},tables=new[]{rows},
                    sourceRows=lines.Select(l=>new {code=l.Code,product_id=l.Code,stores=new[]{new {store_id=store,balance=l.RawQty,booked=l.Booked}}})}};
        }
        async Task Import(params object[] items)
        {
            var body=string.Join("\n",items.Select(o=>JsonSerializer.Serialize(o)));
            (await admin.PostAsync("/api/v1/console/dntrade-archive/import?sourceAccount=valko-dntrade",new StringContent(body,Encoding.UTF8,"application/x-ndjson"),Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        }
        await Import(new{schemaVersion=1,source="dntrade",entityType="store",sourceId=store,raw=new{title=source}},Part(1,(codes[0],"2",2,0)));
        async Task<string> Url(int n)=>Root+"/inventory-reports/"+(await admin.ReadAsync<List<InventoryReport>>(Root+"/inventory-reports")).Single(r=>r.SourceId==source+"-part-"+n).Id;
        var first=await Url(1);
        (await admin.ReadAsync<InventoryPage>(first)).Items.Single().Status.ShouldBe("incomplete");
        await Import(Part(2,(codes[1],"4",4,1),(codes[2],"6",5,0)));
        (await admin.ReadAsync<InventoryPage>(first)).Items.Single().Status.ShouldBe("ready");
        var exceptions=await admin.ReadAsync<InventoryPage>(await Url(2)+"?status=review");
        exceptions.Items.Select(r=>r.Status).ToArray().ShouldBe(["reserved","difference"]);
    }

    [Fact]
    public async Task Confirmed_source_lines_open_stock_once_and_a_mixed_batch_rolls_back()
    {
        using var admin=await Staff.AdminAsync(api);
        var source="review-"+Guid.NewGuid().ToString("N");
        var product=await api.AddProductAsync("ruchnyi-instrument","Перевірка залишків",12m);
        await api.WithDbAsync(db=>db.Set<Product>().Where(p=>p.Id==product.Id).ExecuteUpdateAsync(s=>s.SetProperty(p=>p.NavkoloId,"dntrade-code:"+source)
            .SetProperty(p=>p.DisplayName,"Секатор для перевірки залишків"),Ct));
        object Row(string section,params string[] values)=> new {section,cells=values.Select(value=>new {value})};
        var report=new {schemaVersion=1,source="dntrade",entityType="inventorySnapshot",sourceId=source,sourceDate="2026-11-20",raw=new{
            cutoff="2026-11-20T14:29:21+02:00",scope=new{warehouses=source,groupProductVariants=false},
            tables=new[]{new[]{Row("THEAD","Код","Назва","Од.вим.","Ціна","На початок","Прихід","Розхід","Залишок","Залишок в сумі"),
                Row("TBODY",source,"Товар","шт","0","0,00","4,250","1,00","3,250","0"),Row("TBODY","missing","Інший","шт","0","0","2","0","2","0"),
                Row("TFOOT","","","","","","","","5,25","")}}}};
        var storeRecord=new{schemaVersion=1,source="dntrade",entityType="store",sourceId=source,raw=new{title=source}};
        var orgRecord=new{schemaVersion=1,source="dntrade",entityType="invoice",sourceId=source,documentType="in",organizationId=source,raw=new{organization=new{title=source}}};
        var body=string.Join("\n",new object[]{report,storeRecord,orgRecord}.Select(o=>JsonSerializer.Serialize(o)));
        (await admin.PostAsync("/api/v1/console/dntrade-archive/import?sourceAccount=valko-dntrade",new StringContent(body,Encoding.UTF8,"application/x-ndjson"),Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        var snapshot=(await admin.ReadAsync<List<InventoryReport>>(Root+"/inventory-reports")).Single(r=>r.SourceId==source);
        snapshot.Rows.ShouldBe(2);
        var refs=await admin.ReadAsync<References>(Root+"/references");
        var org=Guid.Parse(refs.Organizations.Single(r=>r.Title==source).Id);
        var store=Guid.Parse(refs.Stores.Single(r=>r.Title==source).Id);
        var url=Root+"/inventory-reports/"+snapshot.Id;
        var ready=(await admin.ReadAsync<InventoryPage>(url+"?org="+org+"&status=ready")).Items.Single();
        ready.Quantity.ShouldBe(3.250m);
        ready.Title.ShouldBe("Товар");
        ready.ProductName.ShouldBe("Секатор для перевірки залишків");
        (await admin.ReadAsync<InventoryPage>(url+"?org="+org+"&q="+Uri.EscapeDataString("для перевірки"))).Items.Single().Position.ShouldBe(ready.Position);
        var request=new ConfirmInventory(org,store,[new(ready.Position,product.Id,3.25m)]);
        (await admin.PostAsJsonAsync(url+"/confirm",request with {Lines=[..request.Lines!,new(3,product.Id,2)]},Ct)).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await admin.ReadAsync<RegisterPage<WarehouseBalance>>(Root+"/warehouse?store="+store)).Total.ShouldBe(0);
        var results=await Task.WhenAll(admin.PostAsJsonAsync(url+"/confirm",request,Ct),admin.PostAsJsonAsync(url+"/confirm",request,Ct));
        results.ShouldAllBe(r=>r.StatusCode==HttpStatusCode.OK);
        var balance=(await admin.ReadAsync<RegisterPage<WarehouseBalance>>(Root+"/warehouse?store="+store)).Items.Single();
        balance.Opening.ShouldBe(3.25m);
        balance.Product.ShouldBe("Секатор для перевірки залишків");
        (await admin.ReadAsync<RegisterPage<WarehouseBalance>>(Root+"/warehouse?store="+store+"&q="+Uri.EscapeDataString("для перевірки"))).Total.ShouldBe(1);
        (await admin.ReadAsync<InventoryPage>(url+"?org="+org+"&status=confirmed")).Items.Single().OpeningOrgId.ShouldBe(org);
        using var clerk=await TestRoles.LoginWithPermissionsAsync(api,admin,PoliValko.Infrastructure.Security.Permissions.PermissionKeys.AccountingView);
        (await clerk.PostAsJsonAsync(url+"/confirm",request,Ct)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }
}

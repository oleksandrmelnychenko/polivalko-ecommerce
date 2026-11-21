using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using PoliValko.Console.Features.Accounting;

namespace PoliValko.IntegrationTests;

public sealed class SalesOfferTests(ApiFactory api)
{
    [Fact]
    public async Task Only_explicit_posted_sales_for_this_partner_convert_an_offer_once()
    {
        var ct = TestContext.Current.CancellationToken;
        var partner = Guid.NewGuid();
        var other = Guid.NewGuid();
        var invoice = Guid.NewGuid();
        var futureInvoice = Guid.NewGuid();
        var day = new DateOnly(2025, 11, 12);
        await api.WithDbAsync(async db =>
        {
            await db.Database.ExecuteSqlAsync($"""
                INSERT INTO accounting.partners(id,source_account,source_id,title,details)
                VALUES ({partner},'offer-test',{partner.ToString()},'A',jsonb_build_object()),
                       ({other},'offer-test',{other.ToString()},'B',jsonb_build_object())
                """,ct);
            return await db.Database.ExecuteSqlAsync($"""
                INSERT INTO accounting.documents(id,source_account,source_id,entity_type,kind,number,day,status,store_ids,
                    native_partner_id,currency,total,details)
                VALUES ({invoice},'offer-test',{invoice.ToString()},'invoice','out','A-01',{day.AddDays(7)},'posted',
                    ARRAY[]::text[],{partner},'UAH',120,jsonb_build_object()),
                    ({futureInvoice},'offer-test',{futureInvoice.ToString()},'invoice','out','B-01',{day},'draft',
                    ARRAY[]::text[],{partner},'UAH',80,jsonb_build_object())
                """,ct);
        });
        using var admin = await Staff.AdminAsync(api);
        const string route = "/api/v1/console/accounting/offers";
        var first = Guid.NewGuid();
        var second = Guid.NewGuid();
        var differentBuyer = Guid.NewGuid();
        var quote = new IssuedOffer(partner, day, "irrigation", "Обладнання для поливу", "statistics");
        foreach (var id in new[]{first,first,second,differentBuyer})
            (await admin.PutAsJsonAsync($"{route}/{id}", id == differentBuyer ? quote with { PartnerId=other, SelectionBasis=null } : quote, ct))
                .StatusCode.ShouldBe(HttpStatusCode.OK);
        (await admin.PutAsJsonAsync($"{route}/{first}", quote with { SelectionBasis="manual" }, ct))
            .StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await admin.PutAsJsonAsync($"{route}/{Guid.NewGuid()}", quote with { SelectionBasis="invalid" }, ct))
            .StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        async Task<HttpStatusCode> Link(Guid id, Guid document) =>
            (await admin.PutAsJsonAsync($"{route}/{id}/invoices/{document}", new {},ct)).StatusCode;
        (await Link(differentBuyer,invoice)).ShouldBe(HttpStatusCode.Conflict);
        (await Link(first,futureInvoice)).ShouldBe(HttpStatusCode.Conflict);
        (await Link(first,invoice)).ShouldBe(HttpStatusCode.OK);
        (await Link(first,invoice)).ShouldBe(HttpStatusCode.OK);
        (await Link(second,invoice)).ShouldBe(HttpStatusCode.Conflict);
        var week = await admin.ReadAsync<List<OfferRow>>(route+"?from=2025-11-10&to=2025-11-16");
        var converted = week.Single(o => o.Id==first);
        converted.Shipments.ShouldBe(1);
        converted.Shipped.ShouldBe(120m);
        converted.InvoiceNumbers.ShouldBe("A-01");
        week.Single(o => o.Id==second).Shipments.ShouldBe(0);
    }
}

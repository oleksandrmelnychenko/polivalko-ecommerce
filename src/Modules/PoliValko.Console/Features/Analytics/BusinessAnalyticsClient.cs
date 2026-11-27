using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Security.Permissions;

namespace PoliValko.Console.Features.Analytics;

internal sealed record OrderWaybillDto(string Number, DateOnly Date);
internal sealed record OrderWaybillsDto(string Status, IReadOnlyList<OrderWaybillDto>? Waybills);

internal sealed class BusinessAnalyticsClient(HttpClient http)
{
    internal sealed record OfferItem(Guid Id, DateOnly Last, decimal Quantity, string Unit, decimal Price, Guid? OfferId);
    private sealed record Buyer(Guid Id, List<OfferItem> Items);
    private sealed record RecommendationReport(List<Buyer> Clients);

    internal async Task<OfferItem?> FindOffer(Guid partner, Guid product, int days, CancellationToken ct)
    {
        if (http.BaseAddress is null) throw new HttpRequestException("Analytics unavailable");
        var report = await http.GetFromJsonAsync<RecommendationReport>(
            $"documents?analysis=customer-recommendations&days={days}", ct);
        return report?.Clients.FirstOrDefault(c => c.Id == partner)?.Items.FirstOrDefault(i => i.Id == product);
    }

    public static void Map(RouteGroupBuilder console)
    {
        var orders = console.MapGroup("/orders").WithTags("Console").RequireStaff(PermissionKeys.OrdersView);
        orders.MapGet("/{number}/waybills", (string number, bool? refresh, BusinessAnalyticsClient client, HttpContext context, CancellationToken ct) =>
        {
            if (number.Length is < 4 or > 22 || !number.StartsWith("PV-", StringComparison.Ordinal)
                || !number[3..].All(char.IsAsciiDigit))
                return Task.FromResult<IResult>(Results.NotFound());
            return client.Send("order-waybills/" + number, context, ct, refresh == true ? "?refresh=true" : "");
        }).WithName("ConsoleOrderWaybills").WithSummary("ТТН з реєстру відправника за номером замовлення магазину")
            .Produces<OrderWaybillsDto>().Produces(StatusCodes.Status404NotFound).ProducesProblem(StatusCodes.Status503ServiceUnavailable);
        var group = console.MapGroup("/business-analytics").WithTags("Console").RequireStaff(PermissionKeys.ProductAnalyticsView);
        foreach (var operation in new[] { "status", "report", "forecast", "documents" })
        {
            var route = group.MapGet("/" + operation, (BusinessAnalyticsClient client, HttpContext context, CancellationToken ct) =>
                client.Send(operation, context, ct)).WithName("BusinessAnalytics" + char.ToUpperInvariant(operation[0]) + operation[1..]);
            if (operation == "documents")
            {
                route.RequirePermission(PermissionKeys.AccountingView)
                    .AddEndpointFilter(async (invocation, next) =>
                    {
                        var context = invocation.HttpContext;
                        if (context.Request.Query["analysis"].Any(value => value is "stock-turnover" or "customer-recommendations" or "recommendation-results"))
                        {
                            var authorization = context.RequestServices.GetRequiredService<IAuthorizationService>();
                            var check = await authorization.AuthorizeAsync(context.User, context,
                                PermissionRequirement.PolicyName([PermissionKeys.ProductsView]));
                            if (!check.Succeeded) return Results.Forbid();
                        }
                        return await next(invocation);
                    });
            }
        }
        group.MapGet("/winter", (BusinessAnalyticsClient client, HttpContext context, CancellationToken ct) =>
            client.Send("winter", context, ct)).RequirePermission(PermissionKeys.AccountingView).WithName("BusinessWinterSales");
        group.MapPost("/offer-draft", (BusinessAnalyticsClient client, HttpContext context, CancellationToken ct) =>
            client.Send("offer-draft", context, ct)).RequirePermission(PermissionKeys.AccountingEdit)
            .RequirePermission(PermissionKeys.AccountingView).WithName("BusinessOfferDraft");
        group.MapPost("/refresh", (BusinessAnalyticsClient client, HttpContext context, CancellationToken ct) =>
            client.Send("refresh", context, ct)).RequirePermission(PermissionKeys.AccountingEdit).WithName("BusinessAnalyticsRefresh");
        group.MapPut("/policy", (BusinessAnalyticsClient client, HttpContext context, CancellationToken ct) =>
            client.Send("policy", context, ct)).RequirePermission(PermissionKeys.AccountingEdit).WithName("BusinessAnalyticsPolicy");
    }

    private async Task<IResult> Send(string path, HttpContext context, CancellationToken ct, string? query = null)
    {
        context.Response.Headers.CacheControl = "private, no-store";
        if (http.BaseAddress is null) return Unavailable();
        var effectiveQuery = query ?? NormalizeQuery(context.Request.Query);
        using var request = new HttpRequestMessage(new HttpMethod(context.Request.Method), path + effectiveQuery);
        try
        {
            if (path == "policy")
            {
                const int limit = 16384;
                var bytes = new byte[limit + 1];
                var size = await context.Request.Body.ReadAtLeastAsync(bytes, bytes.Length, throwOnEndOfStream: false, cancellationToken: ct);
                if (size > limit) return Results.StatusCode(StatusCodes.Status413PayloadTooLarge);
                request.Content = new ByteArrayContent(bytes, 0, size);
                request.Content.Headers.ContentType = new MediaTypeHeaderValue("application/json");
            }
            using var response = await http.SendAsync(request, ct);
            if (response.Content.Headers.ContentType?.MediaType != "application/json") return Unavailable();
            return Results.Content(await response.Content.ReadAsStringAsync(ct), "application/json", statusCode: (int)response.StatusCode);
        }
        catch (HttpRequestException) { return Unavailable(); }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested) { return Unavailable(); }
    }

    private static string NormalizeQuery(IQueryCollection query)
    {
        if (query.Count == 0) return "";
        var parts = new List<string>(query.Count);
        foreach (var (key, values) in query)
        {
            foreach (var raw in values)
            {
                if (string.Equals(key, "refresh", StringComparison.OrdinalIgnoreCase))
                {
                    if (raw is "1" or "true" or "True" or "TRUE") parts.Add("refresh=1");
                    continue;
                }
                parts.Add($"{Uri.EscapeDataString(key)}={Uri.EscapeDataString(raw ?? "")}");
            }
        }
        return parts.Count == 0 ? "" : "?" + string.Join('&', parts);
    }

    private static IResult Unavailable() => Results.Problem(statusCode: 503,
        title: "Сервіс виробничої аналітики недоступний");
}

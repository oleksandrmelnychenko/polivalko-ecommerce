using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using PoliValko.Catalog.Contracts;
using PoliValko.Infrastructure.Security.Permissions;
using PoliValko.Ordering.Contracts;
using PoliValko.SharedKernel;

namespace PoliValko.Console.Features.Search;

internal static class SearchConsole
{
    private const int MinLength = 2;
    private const int Limit = 5;

    public static async Task<Ok<ConsoleSearchDto>> HandleAsync(
        string? q,
        ClaimsPrincipal user,
        HttpContext http,
        [FromServices] IStaffAccessResolver access,
        [FromServices] IOrderReporting orders,
        [FromServices] ICatalogReporting catalog,
        CancellationToken ct)
    {
        var term = q?.Trim() ?? string.Empty;
        if (term.Length < MinLength)
        {
            return TypedResults.Ok(new ConsoleSearchDto([], [], []));
        }

        var mine = await access.GetStaffAccessAsync(user, http.Items, ct);
        var orderHits = mine?.Has(PermissionKeys.OrdersView) == true ? await orders.SearchOrdersAsync(term, Limit, ct) : [];
        var products = mine?.Has(PermissionKeys.ProductsView) == true ? await catalog.SearchProductsAsync(term, Limit, ct) : [];
        var customers = mine?.Has(PermissionKeys.CustomersView) == true ? await orders.SearchCustomersAsync(term, Limit, ct) : [];

        return TypedResults.Ok(new ConsoleSearchDto(
            orderHits.Select(o => new SearchOrderHitDto(o.Number, o.CustomerName, o.CustomerPhone, o.Status, MoneyDto.Hryvnia(o.Total), o.CreatedAt)).ToList(),
            products.Select(p => new SearchProductHitDto(p.Id, p.Name, p.Sku, p.ImageUrl, MoneyDto.Hryvnia(p.Price), p.IsVisible)).ToList(),
            customers.Select(c => new SearchCustomerHitDto(c.Phone, c.Name, c.Orders)).ToList()));
    }
}

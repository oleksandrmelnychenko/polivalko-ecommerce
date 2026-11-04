using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using PoliValko.Customers.Contracts;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Storefront;
using PoliValko.Ordering.Contracts;
using PoliValko.Payments.Configuration;
using PoliValko.Payments.Integrations.Providers;

namespace PoliValko.Payments.Features.Checkout;

internal static class StartAccountPayment
{
    public const string ReturnPath = "/account/orders";

    public static async Task<Results<Ok<StartPaymentDto>, ProblemHttpResult>> HandleAsync(
        string number,
        HttpContext http,
        PoliValkoDbContext db,
        [FromServices] IOrderPayments orders,
        IPaymentProviders providers,
        IOptions<PaymentsOptions> options,
        IOptions<SiteOptions> site,
        TimeProvider time,
        ILoggerFactory loggers,
        CancellationToken ct)
    {
        var order = http.User.CustomerId() is { } customerId
            ? await orders.FindPayableForCustomerAsync(number, customerId, ct)
            : null;
        if (order is null)
        {
            return OrderProblems.NotFound();
        }

        var returnUrl = site.Value.Url($"{ReturnPath}/{order.Number}?payment=return");
        return await StartPayment.StartAsync(order, returnUrl, db, orders, providers, options, site, time, loggers, ct);
    }
}

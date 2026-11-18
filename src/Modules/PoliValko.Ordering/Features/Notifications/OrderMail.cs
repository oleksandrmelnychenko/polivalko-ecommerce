using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using PoliValko.Infrastructure.Storefront;
using PoliValko.Notifications.Contracts;
using PoliValko.Ordering.Domain;

namespace PoliValko.Ordering.Features.Notifications;

internal sealed class OrderMail(ICustomerMailer mailer, IOptions<SiteOptions> site, ILogger<OrderMail> logger)
{
    private readonly List<Placed> _queued = [];

    public void Queue(Order order, string token)
    {
        if (string.IsNullOrWhiteSpace(order.CustomerEmail))
        {
            return;
        }

        var link = site.Value.Url($"/order/{Uri.EscapeDataString(order.Number)}?token={Uri.EscapeDataString(token)}");
        _queued.Add(new Placed(order.CustomerEmail, order.CustomerName, order.Number, link));
    }

    public async Task SendQueuedAsync()
    {
        var placed = _queued.ToArray();
        _queued.Clear();
        foreach (var mail in placed)
        {
            try
            {
                await mailer.SendOrderPlacedAsync(mail.To, mail.Name, mail.Number, mail.Link, CancellationToken.None);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Лист про замовлення {Number} не надіслано", mail.Number);
            }
        }
    }

    private sealed record Placed(string To, string Name, string Number, string Link);
}

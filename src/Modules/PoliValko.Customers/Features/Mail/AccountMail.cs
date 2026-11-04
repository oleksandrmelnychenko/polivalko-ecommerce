using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using PoliValko.Customers.Domain;
using PoliValko.Infrastructure.Storefront;
using PoliValko.Notifications.Contracts;

namespace PoliValko.Customers.Features.Mail;

internal sealed class AccountMail(ICustomerMailer mailer, IOptions<SiteOptions> site, ILogger<AccountMail> logger)
{
    public const string ConfirmEmailPath = "/account/confirm-email";
    public const string ResetPasswordPath = "/account/reset-password";

    public Task<bool> SendConfirmationAsync(Customer customer, string token, CancellationToken ct) =>
        TrySendAsync(customer.Email, () => mailer.SendEmailConfirmationAsync(customer.Email, customer.Name, Link(ConfirmEmailPath, token), ct));

    public Task<bool> SendPasswordResetAsync(Customer customer, string token, CancellationToken ct) =>
        TrySendAsync(customer.Email, () => mailer.SendPasswordResetAsync(customer.Email, customer.Name, Link(ResetPasswordPath, token), ct));

    private string Link(string path, string token) => site.Value.Url($"{path}?token={Uri.EscapeDataString(token)}");

    private async Task<bool> TrySendAsync(string to, Func<Task> send)
    {
        try
        {
            await send();
            return true;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogError(ex, "Лист покупцю {Email} не надіслано", to);
            return false;
        }
    }
}

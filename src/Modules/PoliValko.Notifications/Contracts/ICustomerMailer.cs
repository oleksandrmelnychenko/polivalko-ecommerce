namespace PoliValko.Notifications.Contracts;

public interface ICustomerMailer
{
    bool Delivers { get; }

    Task SendEmailConfirmationAsync(string to, string name, string link, CancellationToken cancellationToken);

    Task SendPasswordResetAsync(string to, string name, string link, CancellationToken cancellationToken);

    Task SendOrderPlacedAsync(string to, string name, string orderNumber, string link, CancellationToken cancellationToken);
}

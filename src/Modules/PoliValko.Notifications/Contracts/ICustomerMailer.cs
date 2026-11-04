namespace PoliValko.Notifications.Contracts;

public interface ICustomerMailer
{
    Task SendEmailConfirmationAsync(string to, string name, string link, CancellationToken cancellationToken);

    Task SendPasswordResetAsync(string to, string name, string link, CancellationToken cancellationToken);
}

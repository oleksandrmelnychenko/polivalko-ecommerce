using Microsoft.Extensions.Logging;
using PoliValko.Notifications.Contracts;

namespace PoliValko.Notifications.Integrations.Log;

internal sealed class LogCustomerMailer(ILogger<LogCustomerMailer> logger) : ICustomerMailer
{
    public Task SendEmailConfirmationAsync(string to, string name, string link, CancellationToken cancellationToken)
    {
        logger.LogInformation("Лист підтвердження email (Email:Mode=Log) для {To}: {Link}", to, link);
        return Task.CompletedTask;
    }

    public Task SendPasswordResetAsync(string to, string name, string link, CancellationToken cancellationToken)
    {
        logger.LogInformation("Лист відновлення пароля (Email:Mode=Log) для {To}: {Link}", to, link);
        return Task.CompletedTask;
    }
}

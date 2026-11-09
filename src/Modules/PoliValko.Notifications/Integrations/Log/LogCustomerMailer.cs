using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Hosting;
using PoliValko.Notifications.Contracts;

namespace PoliValko.Notifications.Integrations.Log;

internal sealed class LogCustomerMailer(ILogger<LogCustomerMailer> logger, IHostEnvironment environment) : ICustomerMailer
{
    public Task SendEmailConfirmationAsync(string to, string name, string link, CancellationToken cancellationToken)
    {
        Log(to, link, "підтвердження email");
        return Task.CompletedTask;
    }

    public Task SendPasswordResetAsync(string to, string name, string link, CancellationToken cancellationToken)
    {
        Log(to, link, "відновлення пароля");
        return Task.CompletedTask;
    }

    private void Log(string to, string link, string purpose)
    {
        if (environment.IsDevelopment())
            logger.LogInformation("Тестовий лист ({Purpose}) для {To}: {Link}", purpose, to, link);
        else
            logger.LogWarning("Email:Mode=Log: лист ({Purpose}) не доставлено; посилання приховано", purpose);
    }
}

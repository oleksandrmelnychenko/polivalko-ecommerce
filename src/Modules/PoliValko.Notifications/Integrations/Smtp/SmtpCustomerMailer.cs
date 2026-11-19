using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Options;
using PoliValko.Notifications.Configuration;
using PoliValko.Notifications.Contracts;

namespace PoliValko.Notifications.Integrations.Smtp;

internal sealed class SmtpCustomerMailer(IOptions<SmtpOptions> options) : ICustomerMailer
{
    public bool Delivers => true;

    public Task SendEmailConfirmationAsync(string to, string name, string link, CancellationToken cancellationToken) =>
        SendAsync(to, name, "Підтвердження електронної пошти",
            $"Підтвердьте свою електронну пошту за посиланням:\n{link}", cancellationToken);

    public Task SendPasswordResetAsync(string to, string name, string link, CancellationToken cancellationToken) =>
        SendAsync(to, name, "Відновлення пароля",
            $"Щоб встановити новий пароль, перейдіть за посиланням:\n{link}\n\nЯкщо ви не запитували зміну пароля, проігноруйте цей лист.", cancellationToken);

    public Task SendOrderPlacedAsync(string to, string name, string orderNumber, string link, CancellationToken cancellationToken) =>
        SendAsync(to, name, $"Замовлення №{orderNumber}",
            $"Ми отримали ваше замовлення. Деталі й поточний статус:\n{link}", cancellationToken);

    private async Task SendAsync(string to, string name, string subject, string body, CancellationToken cancellationToken)
    {
        var settings = options.Value;
        using var message = new MailMessage(new MailAddress(settings.From, "Poli Valko"), new MailAddress(to))
        {
            Subject = subject,
            Body = $"Вітаємо, {name}!\n\n{body}\n\nPoli Valko",
        };
        using var client = new SmtpClient(settings.Host, settings.Port)
        {
            EnableSsl = true,
            Credentials = new NetworkCredential(settings.Username, settings.Password),
        };
        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        deadline.CancelAfter(TimeSpan.FromSeconds(15));

        try
        {
            await client.SendMailAsync(message, deadline.Token);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            throw new TimeoutException("Поштовий сервер не відповів вчасно.");
        }
        catch (SmtpException ex)
        {
            throw new InvalidOperationException($"Поштовий сервер не прийняв повідомлення ({ex.StatusCode}).");
        }
    }
}

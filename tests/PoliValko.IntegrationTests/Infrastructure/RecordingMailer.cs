using System.Collections.Concurrent;
using PoliValko.Notifications.Contracts;

namespace PoliValko.IntegrationTests;

public enum MailKind
{
    EmailConfirmation,
    PasswordReset,
}

public sealed record SentMail(MailKind Kind, string To, string Name, string Link);

public sealed class RecordingMailer : ICustomerMailer
{
    public ConcurrentQueue<SentMail> Sent { get; } = new();

    public Task SendEmailConfirmationAsync(string to, string name, string link, CancellationToken cancellationToken)
    {
        Sent.Enqueue(new SentMail(MailKind.EmailConfirmation, to, name, link));
        return Task.CompletedTask;
    }

    public Task SendPasswordResetAsync(string to, string name, string link, CancellationToken cancellationToken)
    {
        Sent.Enqueue(new SentMail(MailKind.PasswordReset, to, name, link));
        return Task.CompletedTask;
    }

    public IReadOnlyList<SentMail> To(string email, MailKind kind) =>
        Sent.Where(m => m.Kind == kind && string.Equals(m.To, email, StringComparison.OrdinalIgnoreCase)).ToList();

    public string LastToken(string email, MailKind kind)
    {
        var link = To(email, kind).LastOrDefault()?.Link ?? throw new ShouldAssertException($"Листа {kind} для {email} немає");
        var token = new Uri(link).Query.TrimStart('?').Split('&')
            .Select(part => part.Split('=', 2))
            .Single(pair => pair[0] == "token")[1];
        return Uri.UnescapeDataString(token);
    }
}

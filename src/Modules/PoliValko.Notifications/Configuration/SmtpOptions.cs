using System.Net.Mail;

namespace PoliValko.Notifications.Configuration;

internal sealed class SmtpOptions
{
    public string Host { get; set; } = "";
    public int Port { get; set; } = 587;
    public string From { get; set; } = "";
    public string Username { get; set; } = "";
    public string Password { get; set; } = "";

    public bool IsConfigured =>
        Uri.CheckHostName(Host) != UriHostNameType.Unknown &&
        Port is > 0 and <= 65535 &&
        MailAddress.TryCreate(From, out var address) &&
        string.Equals(address.Address, From, StringComparison.OrdinalIgnoreCase) &&
        !string.IsNullOrWhiteSpace(Username) &&
        !string.IsNullOrWhiteSpace(Password);
}

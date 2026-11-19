using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using PoliValko.Notifications;
using PoliValko.Notifications.Configuration;
using PoliValko.Notifications.Contracts;

namespace PoliValko.UnitTests;

public sealed class EmailConfigurationTests
{
    [Theory]
    [InlineData("mail.shop.test", "587", "orders@shop.test", "mailer", "test-only", true)]
    [InlineData("mail.shop.test", "587", "orders@shop.test", "mailer", "", false)]
    [InlineData("https://mail.shop.test", "587", "orders@shop.test", "mailer", "test-only", false)]
    [InlineData("mail.shop.test", "65536", "orders@shop.test", "mailer", "test-only", false)]
    [InlineData("mail.shop.test", "587", "Shop <orders@shop.test>", "mailer", "test-only", false)]
    public void Smtp_starts_only_with_complete_mailbox_and_relay_configuration(
        string host, string port, string from, string username, string password, bool valid)
    {
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Email:Mode"] = "Smtp",
            ["Email:Smtp:Host"] = host,
            ["Email:Smtp:Port"] = port,
            ["Email:Smtp:From"] = from,
            ["Email:Smtp:Username"] = username,
            ["Email:Smtp:Password"] = password,
        }).Build();
        using var services = new ServiceCollection().AddNotificationsModule(configuration).BuildServiceProvider();
        var options = services.GetRequiredService<IOptions<SmtpOptions>>();

        if (valid)
        {
            options.Value.IsConfigured.ShouldBeTrue();
            services.GetRequiredService<ICustomerMailer>().Delivers.ShouldBeTrue();
        }
        else
        {
            Should.Throw<OptionsValidationException>(() => options.Value);
        }
    }
}

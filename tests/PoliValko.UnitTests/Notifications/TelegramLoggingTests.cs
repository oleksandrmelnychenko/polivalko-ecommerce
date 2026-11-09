using System.Net;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using PoliValko.Notifications;
using PoliValko.Notifications.Contracts;
using PoliValko.Notifications.Integrations.Channels;

namespace PoliValko.UnitTests;

public sealed class TelegramLoggingTests
{
    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Factory_and_exception_logs_never_contain_bot_token(bool fail)
    {
        const string token = "test-only-secret-token";
        var logs = new CaptureLogs();
        var services = new ServiceCollection();
        services.AddLogging(b => b.SetMinimumLevel(LogLevel.Trace).AddProvider(logs));
        services.AddNotificationsModule(new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Notifications:Telegram:BotToken"] = token,
        }).Build());
        services.AddHttpClient(nameof(IManagerNotifier)).ConfigurePrimaryHttpMessageHandler(() => new FakeTelegram(fail));
        using var provider = services.BuildServiceProvider();
        var channel = provider.GetRequiredService<IManagerChannel>();
        var delivered = await channel.SendAsync(new ManagerNotification("Test", "Body", ManagerEvent.Test), ["123"], TestContext.Current.CancellationToken);
        delivered.ShouldBe(fail ? 0 : 1);
        string.Join("\n", logs.Messages).ShouldNotContain(token);
    }

    private sealed class FakeTelegram(bool fail) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            if (fail) throw new HttpRequestException("Failed " + request.RequestUri);
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK));
        }
    }

    private sealed class CaptureLogs : ILoggerProvider, ILogger
    {
        public List<string> Messages { get; } = [];
        public ILogger CreateLogger(string categoryName) => this;
        public void Dispose() { }
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
        public bool IsEnabled(LogLevel logLevel) => true;
        public void Log<TState>(LogLevel level, EventId id, TState state, Exception? exception, Func<TState, Exception?, string> formatter) =>
            Messages.Add(formatter(state, exception) + state + exception);
    }
}

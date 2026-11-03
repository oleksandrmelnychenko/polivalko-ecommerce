namespace PoliValko.Notifications.Configuration;

public sealed class TelegramOptions
{
    public string? BotToken { get; set; }

    public string? ChatId { get; set; }

    public bool IsConfigured => !string.IsNullOrWhiteSpace(BotToken) && !string.IsNullOrWhiteSpace(ChatId);
}

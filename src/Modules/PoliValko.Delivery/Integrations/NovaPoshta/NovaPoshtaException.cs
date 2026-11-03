namespace PoliValko.Delivery.Integrations.NovaPoshta;

internal sealed class NovaPoshtaException(
    string message,
    bool isTransient = false,
    TimeSpan? retryAfter = null,
    Exception? innerException = null) : Exception(message, innerException)
{
    public bool IsTransient { get; } = isTransient;

    public TimeSpan? RetryAfter { get; } = retryAfter;
}

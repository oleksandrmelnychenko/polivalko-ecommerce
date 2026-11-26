namespace PoliValko.Ordering.Contracts;

public interface ICardPayments
{
    /// <summary>The online payment options the buyer can choose from; empty when online payment is off.</summary>
    Task<IReadOnlyList<CardPaymentOption>> GetOptionsAsync(CancellationToken ct);
}

public sealed record CardPaymentOption(string Code, string Name, string Hint);

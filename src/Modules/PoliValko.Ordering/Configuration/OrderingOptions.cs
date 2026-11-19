namespace PoliValko.Ordering.Configuration;

public sealed class OrderingOptions
{
    public int UnpaidCardOrderHours { get; set; } = 24;

    public int UnconfirmedOrderHours { get; set; } = 48;
}

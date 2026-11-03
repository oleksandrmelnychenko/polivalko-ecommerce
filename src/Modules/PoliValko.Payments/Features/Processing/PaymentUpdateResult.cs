namespace PoliValko.Payments.Features.Processing;

public enum PaymentUpdateResult
{
    Applied,
    Duplicate,
    Stale,
    UnknownPayment,
}

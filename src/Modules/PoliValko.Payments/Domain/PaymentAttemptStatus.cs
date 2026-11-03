namespace PoliValko.Payments.Domain;

public enum PaymentAttemptStatus
{
    Created,
    Processing,
    Succeeded,
    Failed,
    Expired,

    Reversed,
}

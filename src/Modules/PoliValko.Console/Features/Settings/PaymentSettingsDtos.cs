namespace PoliValko.Console.Features.Settings;

public sealed record ReceiptIssueDto(string Card, string CashOnDelivery, string Pickup);

public sealed record PaymentSettingsDto(
    string Provider,
    string Mode,
    DateTimeOffset? LastReconcileAt,
    string FiscalProvider,
    string FiscalMode,
    ReceiptIssueDto IssueOn);

namespace PoliValko.Fiscal.Integrations.Providers;

public sealed record IssuedReceipt(string ProviderReceiptId, string? FiscalCode, string? Url);

namespace PoliValko.Fiscal.Integrations.Providers;

public sealed record ReceiptDraft(Guid Id, string OrderNumber, bool IsReturn, IReadOnlyList<ReceiptGood> Goods, string PaymentType, decimal Amount);

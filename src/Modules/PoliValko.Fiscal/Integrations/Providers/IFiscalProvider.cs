namespace PoliValko.Fiscal.Integrations.Providers;

public interface IFiscalProvider
{
    string Name { get; }

    Task<IssuedReceipt> IssueAsync(ReceiptDraft draft, CancellationToken ct);
}

using PoliValko.Fiscal.Integrations.Providers;

namespace PoliValko.Fiscal.Integrations.Stub;

internal sealed class StubFiscalProvider : IFiscalProvider
{
    public string Name => "stub";

    public Task<IssuedReceipt> IssueAsync(ReceiptDraft draft, CancellationToken ct) =>
        Task.FromResult(new IssuedReceipt($"stub-{draft.Id:N}", $"TEST-{draft.Id.ToString("N")[..10].ToUpperInvariant()}", null));
}

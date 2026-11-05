using PoliValko.Ordering.Contracts;

namespace PoliValko.Fiscal.Contracts;

public interface IFiscalSettings
{
    string Provider { get; }

    string Mode { get; }

    string IssueOn(PaymentMethod method);
}

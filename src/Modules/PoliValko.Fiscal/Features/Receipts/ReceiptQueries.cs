using Microsoft.EntityFrameworkCore;
using PoliValko.Fiscal.Domain;
using PoliValko.Infrastructure.Persistence;
using PoliValko.SharedKernel;

namespace PoliValko.Fiscal.Features.Receipts;

internal static class ReceiptQueries
{
    public static async Task<List<ReceiptDto>> ListAsync(PoliValkoDbContext db, string number, bool issuedOnly, CancellationToken ct)
    {
        var receipts = db.Set<Receipt>().AsNoTracking().Where(r => r.OrderNumber == number);
        if (issuedOnly)
        {
            receipts = receipts.Where(r => r.Status == ReceiptStatus.Issued);
        }

        var rows = await receipts.OrderBy(r => r.CreatedAt).ToListAsync(ct);
        return rows.Select(r => new ReceiptDto(
                r.Id, r.Kind, r.Status, MoneyDto.Hryvnia(r.Amount), r.PaymentType, r.Provider, r.FiscalCode, r.Url, r.CreatedAt, r.IssuedAt, r.Error))
            .ToList();
    }
}

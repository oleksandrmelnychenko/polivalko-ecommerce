using PoliValko.Infrastructure.Sync;

namespace PoliValko.Catalog.Contracts;

public sealed record CatalogImportResult(int Created, int Updated, int Unchanged, IReadOnlyList<SyncError> Errors)
{
    public string Summary => $"Нових: {Created}, оновлено: {Updated}, без змін: {Unchanged}, помилок: {Errors.Count}";
}

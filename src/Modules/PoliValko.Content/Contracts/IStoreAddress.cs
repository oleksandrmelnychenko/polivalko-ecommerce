namespace PoliValko.Content.Contracts;

public interface IStoreAddress
{
    Task<string?> ReadAsync(CancellationToken ct);
}

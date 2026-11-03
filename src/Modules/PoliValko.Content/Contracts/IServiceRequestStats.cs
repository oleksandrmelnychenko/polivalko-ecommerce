namespace PoliValko.Content.Contracts;

public interface IServiceRequestStats
{
    Task<int> CountNewAsync(CancellationToken ct);
}

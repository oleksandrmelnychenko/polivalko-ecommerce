namespace PoliValko.Navkolo.Contracts;

public interface INavkoloSettings
{
    bool OrderSyncEnabled => true;
    Task<string> GetModeAsync(CancellationToken ct);
}

namespace PoliValko.Navkolo.Contracts;

public interface INavkoloSettings
{
    Task<string> GetModeAsync(CancellationToken ct);
}

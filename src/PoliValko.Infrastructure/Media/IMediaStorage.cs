namespace PoliValko.Infrastructure.Media;

public interface IMediaStorage
{
    Task<StoredMedia> SaveImageAsync(string folder, Stream content, CancellationToken ct);

    Task DeleteAsync(string url, CancellationToken ct);
}

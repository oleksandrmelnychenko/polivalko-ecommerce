namespace PoliValko.Infrastructure.Media;

public sealed class MediaOptions
{
    public string Root { get; set; } = "media";

    public string PublicPath { get; set; } = "/api/media";

    public long MaxUploadBytes { get; set; } = 10 * 1024 * 1024;
}

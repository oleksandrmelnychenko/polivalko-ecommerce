using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;

namespace PoliValko.Infrastructure.Media;

internal sealed class LocalMediaStorage(IOptions<MediaOptions> options, IHostEnvironment environment, TimeProvider time) : IMediaStorage
{
    public async Task<StoredMedia> SaveImageAsync(string folder, Stream content, CancellationToken ct)
    {
        var settings = options.Value;
        using var buffer = new MemoryStream();
        await CopyLimitedAsync(content, buffer, settings.MaxUploadBytes, ct);
        var bytes = buffer.GetBuffer().AsSpan(0, (int)buffer.Length);

        var (extension, contentType) = Detect(bytes)
            ?? throw new MediaValidationException("Підтримуються лише зображення JPEG, PNG або WebP.");

        var now = time.GetUtcNow();
        var relative = Path.Combine(Sanitize(folder), now.ToString("yyyy"), now.ToString("MM"), $"{Guid.CreateVersion7(now):N}{extension}");
        var path = Path.Combine(RootPath(settings, environment), relative);
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        await File.WriteAllBytesAsync(path, buffer.ToArray(), ct);

        return new StoredMedia($"{settings.PublicPath.TrimEnd('/')}/{relative.Replace('\\', '/')}", contentType, buffer.Length);
    }

    public Task DeleteAsync(string url, CancellationToken ct)
    {
        var settings = options.Value;
        var prefix = settings.PublicPath.TrimEnd('/') + "/";
        if (!url.StartsWith(prefix, StringComparison.Ordinal))
        {
            return Task.CompletedTask;
        }

        var root = Path.GetFullPath(RootPath(settings, environment));
        var path = Path.GetFullPath(Path.Combine(root, url[prefix.Length..]));
        if (path.StartsWith(root + Path.DirectorySeparatorChar, StringComparison.Ordinal) && File.Exists(path))
        {
            File.Delete(path);
        }

        return Task.CompletedTask;
    }

    internal static string RootPath(MediaOptions settings, IHostEnvironment environment) =>
        Path.IsPathRooted(settings.Root) ? settings.Root : Path.Combine(environment.ContentRootPath, settings.Root);

    private static async Task CopyLimitedAsync(Stream source, MemoryStream target, long limit, CancellationToken ct)
    {
        var chunk = new byte[81920];
        int read;
        while ((read = await source.ReadAsync(chunk, ct)) > 0)
        {
            if (target.Length + read > limit)
            {
                throw new MediaValidationException($"Файл більший за {limit / 1024 / 1024} МБ.");
            }

            target.Write(chunk, 0, read);
        }
    }

    private static (string Extension, string ContentType)? Detect(ReadOnlySpan<byte> bytes)
    {
        if (bytes.Length >= 3 && bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF)
        {
            return (".jpg", "image/jpeg");
        }

        if (bytes.Length >= 8 && bytes[..8].SequenceEqual(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A }))
        {
            return (".png", "image/png");
        }

        if (bytes.Length >= 12 && bytes[..4].SequenceEqual("RIFF"u8) && bytes[8..12].SequenceEqual("WEBP"u8))
        {
            return (".webp", "image/webp");
        }

        return null;
    }

    private static string Sanitize(string folder) =>
        new string(folder.Where(c => char.IsAsciiLetterOrDigit(c) || c == '-').ToArray()) is { Length: > 0 } clean ? clean : "misc";
}

using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace PoliValko.Infrastructure.Media;

public sealed class ProductPhotoStorage(
    HttpClient client,
    IConfiguration configuration,
    IHttpContextAccessor context,
    IMediaStorage legacy,
    IOptions<MediaOptions> options,
    TimeProvider time,
    ILogger<ProductPhotoStorage> logger)
{
    private const string UploadPrefix = "catalog/uploads/";
    private const string BlobApi = "https://vercel.com/api/blob";

    private string? StoreId
    {
        get
        {
            var value = configuration["BLOB_STORE_ID"];
            return value?.StartsWith("store_", StringComparison.OrdinalIgnoreCase) == true ? value[6..] : value;
        }
    }

    public async Task<StoredMedia> SaveAsync(Stream source, CancellationToken ct)
    {
        if (string.IsNullOrEmpty(StoreId))
        {
            return await legacy.SaveImageAsync("products", source, ct);
        }

        using var buffer = new MemoryStream();
        var chunk = new byte[81920];
        int read;
        var maxBytes = options.Value.MaxUploadBytes;
        while ((read = await source.ReadAsync(chunk, ct)) > 0)
        {
            if (buffer.Length + read > maxBytes)
            {
                throw new MediaValidationException($"Файл більший за {maxBytes / 1024 / 1024} МБ.");
            }

            buffer.Write(chunk, 0, read);
        }

        var bytes = buffer.ToArray();
        var (extension, contentType) = Detect(bytes)
            ?? throw new MediaValidationException("Завантажте зображення у форматі JPEG, PNG або WebP.");
        var now = time.GetUtcNow();
        var date = now.ToString("yyyy/MM", CultureInfo.InvariantCulture);
        var path = $"{UploadPrefix}{date}/{Guid.CreateVersion7(now):N}{extension}";
        using var request = CreateRequest(HttpMethod.Put, $"/?pathname={Uri.EscapeDataString(path)}");
        request.Content = new ByteArrayContent(bytes);
        request.Headers.Add("x-content-type", contentType);
        request.Headers.Add("x-vercel-blob-access", "public");
        request.Headers.Add("x-add-random-suffix", "0");
        request.Headers.Add("x-allow-overwrite", "0");

        using var response = await SendAsync(request, ct);
        BlobUploadResult? saved;
        try
        {
            saved = await response.Content.ReadFromJsonAsync<BlobUploadResult>(ct);
        }
        catch (JsonException)
        {
            throw new ProductPhotoStorageException("Vercel Blob returned an invalid upload response.");
        }
        if (saved is null || !IsOwnedUpload(saved.Url) || !Uri.TryCreate(saved.Url, UriKind.Absolute, out var image)
            || image.AbsolutePath != "/" + path)
        {
            throw new ProductPhotoStorageException("Vercel Blob returned an unexpected upload URL.");
        }

        return new StoredMedia(image.AbsoluteUri, contentType, bytes.LongLength);
    }

    public async Task DeleteAsync(string url, CancellationToken ct)
    {
        if (!IsOwnedUpload(url))
        {
            await legacy.DeleteAsync(url, ct);
            return;
        }

        try
        {
            using var request = CreateRequest(HttpMethod.Post, "/delete");
            request.Content = JsonContent.Create(new { urls = new[] { url } });
            using var response = await SendAsync(request, ct, allowNotFound: true);
        }
        catch (ProductPhotoStorageException ex)
        {
            logger.LogWarning("Could not remove Blob photo after detaching it from the catalog: {Reason}", ex.Message);
        }
    }

    private HttpRequestMessage CreateRequest(HttpMethod method, string resource)
    {
        var store = StoreId;
        var writeToken = configuration["BLOB_READ_WRITE_TOKEN"];
        var oidcToken = context.HttpContext?.Request.Headers["x-vercel-oidc-token"].ToString();
        if (string.IsNullOrWhiteSpace(oidcToken))
        {
            oidcToken = configuration["VERCEL_OIDC_TOKEN"];
        }

        var token = string.IsNullOrWhiteSpace(writeToken) ? oidcToken : writeToken;
        if (string.IsNullOrWhiteSpace(store) || !store.All(char.IsAsciiLetterOrDigit) || string.IsNullOrWhiteSpace(token))
        {
            throw new ProductPhotoStorageException("Vercel Blob credentials are unavailable.");
        }

        var request = new HttpRequestMessage(method, BlobApi + resource);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        // Use the version and store binding of the Vercel Blob SDK wire protocol.
        request.Headers.Add("x-api-version", "13");
        request.Headers.Add("x-vercel-blob-store-id", store);
        request.Headers.Add("x-api-blob-request-id", $"{store}:{time.GetUtcNow().ToUnixTimeMilliseconds()}:{Guid.NewGuid():N}");
        request.Headers.Add("x-api-blob-request-attempt", "0");
        return request;
    }

    private async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct, bool allowNotFound = false)
    {
        try
        {
            var response = await client.SendAsync(request, ct);
            if (response.IsSuccessStatusCode || (allowNotFound && response.StatusCode == HttpStatusCode.NotFound))
            {
                return response;
            }

            var status = (int)response.StatusCode;
            response.Dispose();
            throw new ProductPhotoStorageException($"Vercel Blob returned HTTP {status}.");
        }
        catch (HttpRequestException)
        {
            throw new ProductPhotoStorageException("Vercel Blob could not be reached.");
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            throw new ProductPhotoStorageException("Vercel Blob request timed out.");
        }
    }

    private bool IsOwnedUpload(string? url) =>
        Uri.TryCreate(url, UriKind.Absolute, out var image)
        && image.Scheme == Uri.UriSchemeHttps && image.IsDefaultPort
        && string.Equals(image.Host, $"{StoreId}.public.blob.vercel-storage.com", StringComparison.OrdinalIgnoreCase)
        && image.AbsolutePath.StartsWith("/" + UploadPrefix, StringComparison.Ordinal)
        && string.IsNullOrEmpty(image.UserInfo) && string.IsNullOrEmpty(image.Query) && string.IsNullOrEmpty(image.Fragment);

    private static (string Extension, string ContentType)? Detect(ReadOnlySpan<byte> bytes)
    {
        if (bytes.StartsWith(new byte[] { 0xFF, 0xD8, 0xFF })) return (".jpg", "image/jpeg");
        if (bytes.StartsWith(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A })) return (".png", "image/png");
        if (bytes.Length >= 12 && bytes[..4].SequenceEqual("RIFF"u8) && bytes[8..12].SequenceEqual("WEBP"u8)) return (".webp", "image/webp");
        return null;
    }

    private sealed record BlobUploadResult(string Url);
}

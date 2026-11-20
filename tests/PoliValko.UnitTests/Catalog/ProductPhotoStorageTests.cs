using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using PoliValko.Infrastructure.Media;

namespace PoliValko.UnitTests.Catalog;

public sealed class ProductPhotoStorageTests
{
    private static readonly byte[] Jpeg = [0xff, 0xd8, 0xff, 0xe0, 0x01];
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Configured_store_uploads_to_public_blob_with_request_oidc()
    {
        var storage = Storage(async request =>
        {
            request.Method.ShouldBe(HttpMethod.Put);
            request.RequestUri!.GetLeftPart(UriPartial.Path).ShouldBe("https://vercel.com/api/blob/");
            request.Headers.Authorization!.Parameter.ShouldBe("test-oidc");
            request.Headers.GetValues("x-vercel-blob-store-id").Single().ShouldBe("example");
            request.Headers.GetValues("x-vercel-blob-access").Single().ShouldBe("public");
            request.Headers.GetValues("x-content-type").Single().ShouldBe("image/jpeg");
            (await request.Content!.ReadAsByteArrayAsync(Ct)).ShouldBe(Jpeg);
            var pathname = Uri.UnescapeDataString(request.RequestUri.Query["?pathname=".Length..]);
            pathname.ShouldStartWith("catalog/uploads/");
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = JsonContent.Create(new { url = "https://example.public.blob.vercel-storage.com/" + pathname }),
            };
        });

        var image = await storage.SaveAsync(new MemoryStream(Jpeg), Ct);
        image.Url.ShouldStartWith("https://example.public.blob.vercel-storage.com/catalog/uploads/");
        image.ContentType.ShouldBe("image/jpeg");
    }

    [Fact]
    public async Task Provider_error_does_not_save_to_the_legacy_store()
    {
        var storage = Storage(_ => Task.FromResult(new HttpResponseMessage(HttpStatusCode.Forbidden)));
        await Should.ThrowAsync<ProductPhotoStorageException>(() => storage.SaveAsync(new MemoryStream(Jpeg), Ct));
    }

    [Fact]
    public async Task Store_upload_rejects_unsupported_image_before_calling_blob()
    {
        var storage = Storage(_ => throw new InvalidOperationException("Unexpected Blob request."));
        await Should.ThrowAsync<MediaValidationException>(() => storage.SaveAsync(new MemoryStream("not an image"u8.ToArray()), Ct));
    }

    private static ProductPhotoStorage Storage(Func<HttpRequestMessage, Task<HttpResponseMessage>> response)
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["BLOB_STORE_ID"] = "store_example" })
            .Build();
        var context = new DefaultHttpContext();
        context.Request.Headers["x-vercel-oidc-token"] = "test-oidc";
        return new ProductPhotoStorage(new HttpClient(new Handler(response)), configuration,
            new HttpContextAccessor { HttpContext = context }, new UnusedLegacyStorage(),
            Options.Create(new MediaOptions()), TimeProvider.System, NullLogger<ProductPhotoStorage>.Instance);
    }

    private sealed class Handler(Func<HttpRequestMessage, Task<HttpResponseMessage>> response) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct) => response(request);
    }

    private sealed class UnusedLegacyStorage : IMediaStorage
    {
        public Task<StoredMedia> SaveImageAsync(string folder, Stream content, CancellationToken ct) =>
            throw new InvalidOperationException("Unexpected legacy upload.");

        public Task DeleteAsync(string url, CancellationToken ct) => throw new InvalidOperationException("Unexpected legacy delete.");
    }
}

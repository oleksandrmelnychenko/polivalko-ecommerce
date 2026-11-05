using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Media;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Console.Features.Media;

internal static class UploadContentImage
{
    public const string Folder = "content";

    public static async Task<Results<Ok<UploadedImageDto>, ValidationProblem>> HandleAsync(
        IFormFile file,
        IMediaStorage media,
        IAuditLog audit,
        PoliValkoDbContext db,
        CancellationToken ct)
    {
        StoredMedia stored;
        try
        {
            await using var stream = file.OpenReadStream();
            stored = await media.SaveImageAsync(Folder, stream, ct);
        }
        catch (MediaValidationException ex)
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["file"] = [ex.Message] });
        }

        audit.Record("media.image_uploaded", "Media", stored.Url, new { file.FileName, stored.ContentType, stored.Length });
        await db.SaveChangesAsync(ct);
        return TypedResults.Ok(new UploadedImageDto(stored.Url));
    }
}

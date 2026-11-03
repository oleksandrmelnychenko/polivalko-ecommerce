namespace PoliValko.Infrastructure.Text;

public interface IRichTextSanitizer
{
    string? Sanitize(string? html);
}

using System.Globalization;
using Npgsql;

namespace PoliValko.Infrastructure.Persistence;

public static class TrigramSearch
{
    public const double WordSimilarityThreshold = 0.5;

    public static string WithSessionSettings(string connectionString)
    {
        var builder = new NpgsqlConnectionStringBuilder(connectionString);
        var threshold = $"-c pg_trgm.word_similarity_threshold={WordSimilarityThreshold.ToString(CultureInfo.InvariantCulture)}";
        builder.Options = string.IsNullOrWhiteSpace(builder.Options) ? threshold : $"{builder.Options} {threshold}";
        return builder.ConnectionString;
    }
}

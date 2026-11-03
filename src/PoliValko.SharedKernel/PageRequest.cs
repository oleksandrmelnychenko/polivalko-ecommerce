namespace PoliValko.SharedKernel;

public readonly record struct PageRequest(int Page, int PageSize)
{
    public const int DefaultPageSize = 24;
    public const int MaxPageSize = 100;

    public int Skip => (Page - 1) * PageSize;

    public static PageRequest From(int? page, int? pageSize) =>
        new(Math.Max(page ?? 1, 1), Math.Clamp(pageSize ?? DefaultPageSize, 1, MaxPageSize));
}

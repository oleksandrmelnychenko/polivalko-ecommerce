namespace PoliValko.SharedKernel;

public sealed record PagedResponse<T>(IReadOnlyList<T> Items, int Page, int PageSize, int TotalItems, int TotalPages)
{
    public static PagedResponse<T> Create(IReadOnlyList<T> items, PageRequest page, int totalItems) =>
        new(items, page.Page, page.PageSize, totalItems, totalItems == 0 ? 0 : (int)Math.Ceiling(totalItems / (double)page.PageSize));
}

public readonly record struct PageRequest(int Page, int PageSize)
{
    public const int DefaultPageSize = 24;
    public const int MaxPageSize = 100;

    public int Skip => (Page - 1) * PageSize;

    public static PageRequest From(int? page, int? pageSize) =>
        new(Math.Max(page ?? 1, 1), Math.Clamp(pageSize ?? DefaultPageSize, 1, MaxPageSize));
}

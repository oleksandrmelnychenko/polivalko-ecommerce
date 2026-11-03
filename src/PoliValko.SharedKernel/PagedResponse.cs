namespace PoliValko.SharedKernel;

public sealed record PagedResponse<T>(IReadOnlyList<T> Items, int Page, int PageSize, int TotalItems, int TotalPages)
{
    public static PagedResponse<T> Create(IReadOnlyList<T> items, PageRequest page, int totalItems) =>
        new(items, page.Page, page.PageSize, totalItems, totalItems == 0 ? 0 : (int)Math.Ceiling(totalItems / (double)page.PageSize));
}

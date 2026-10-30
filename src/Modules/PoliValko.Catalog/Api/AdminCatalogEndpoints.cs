using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Domain;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Media;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Web;
using PoliValko.SharedKernel;

namespace PoliValko.Catalog.Api;

/// <summary>
/// Адмінка каталогу (розділ 9 ТЗ): видимість, описи, фото, характеристики, SEO, підкатегорії,
/// добірки головної й перенаправлення. Поля Navkolo тут не змінюються.
/// Товари й добірки редагують адміністратор і менеджер; структуру розділів і перенаправлення — адміністратор.
/// </summary>
public static partial class AdminCatalogEndpoints
{
    public static RouteGroupBuilder MapAdminCatalogEndpoints(this RouteGroupBuilder admin)
    {
        var catalog = admin.MapGroup("/catalog").WithTags("Admin");

        var products = catalog.MapGroup("/products").RequireStaff();
        products.MapGet(string.Empty, ListProductsAsync)
            .WithName("AdminListProducts")
            .WithSummary("Товари: пошук за назвою чи артикулом, фільтр за розділом, видимістю й залишком");
        products.MapPost("/visibility", SetVisibilityAsync)
            .WithName("AdminSetProductsVisibility")
            .WithSummary("Показати або приховати кілька товарів одним запитом (до 200)");
        products.MapGet("/{id:guid}", GetProductAsync)
            .WithName("AdminGetProduct")
            .WithSummary("Товар: поля Navkolo (лише читання) і поля сайту")
            .ProducesProblem(StatusCodes.Status404NotFound);
        products.MapPut("/{id:guid}", UpdateProductAsync)
            .WithName("AdminUpdateProduct")
            .WithSummary("Поля сайту: назва для вітрини, адреса, розділ, опис, характеристики, SEO, видимість")
            .ProducesProblem(StatusCodes.Status404NotFound);
        products.MapPost("/{id:guid}/images", UploadImageAsync)
            .DisableAntiforgery() // CSRF перевіряє фільтр групи за заголовком X-CSRF-TOKEN.
            .WithName("AdminUploadProductImage")
            .WithSummary("Завантаження фото (JPEG, PNG або WebP, до 10 МБ)")
            .ProducesProblem(StatusCodes.Status404NotFound);
        products.MapPut("/{id:guid}/images", UpdateImagesAsync)
            .WithName("AdminUpdateProductImages")
            .WithSummary("Порядок фото та підписи alt")
            .ProducesProblem(StatusCodes.Status404NotFound);
        products.MapDelete("/{id:guid}/images/{imageId:guid}", DeleteImageAsync)
            .WithName("AdminDeleteProductImage")
            .WithSummary("Видалення фото")
            .ProducesProblem(StatusCodes.Status404NotFound);

        catalog.MapGroup("/attribute-names").RequireStaff()
            .MapGet(string.Empty, ListAttributeNamesAsync)
            .WithName("AdminListAttributeNames")
            .WithSummary("Назви характеристик товарів розділу (для налаштування фільтрів)");

        var categories = catalog.MapGroup("/categories").RequireStaff(StaffPolicies.Admin);
        categories.MapGet(string.Empty, ListCategoriesAsync)
            .WithName("AdminListCategories")
            .WithSummary("Розділи й підрозділи з порядком, видимістю, зв'язком із Navkolo і фільтрами");
        categories.MapPost(string.Empty, CreateCategoryAsync)
            .WithName("AdminCreateCategory")
            .WithSummary("Новий підрозділ. Верхній рівень відповідає групам Navkolo й не створюється вручну.");
        categories.MapPut("/{id:guid}", UpdateCategoryAsync)
            .WithName("AdminUpdateCategory")
            .WithSummary("Зміна розділу; зміна адреси створює перенаправлення")
            .ProducesProblem(StatusCodes.Status404NotFound);
        categories.MapDelete("/{id:guid}", DeleteCategoryAsync)
            .WithName("AdminDeleteCategory")
            .WithSummary("Видалення порожнього підрозділу")
            .ProducesProblem(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status409Conflict);

        var collections = catalog.MapGroup("/collections").RequireStaff();
        collections.MapGet(string.Empty, ListCollectionsAsync)
            .WithName("AdminListCollections")
            .WithSummary("Добірки головної");
        collections.MapPost(string.Empty, CreateCollectionAsync)
            .WithName("AdminCreateCollection")
            .WithSummary("Нова добірка");
        collections.MapPut("/{id:guid}", UpdateCollectionAsync)
            .WithName("AdminUpdateCollection")
            .WithSummary("Назва, порядок, видимість і товари добірки")
            .ProducesProblem(StatusCodes.Status404NotFound);
        collections.MapDelete("/{id:guid}", DeleteCollectionAsync)
            .WithName("AdminDeleteCollection")
            .WithSummary("Видалення добірки")
            .ProducesProblem(StatusCodes.Status404NotFound);

        var redirects = catalog.MapGroup("/redirects").RequireStaff(StaffPolicies.Admin);
        redirects.MapGet(string.Empty, ListRedirectsAsync)
            .WithName("AdminListRedirects")
            .WithSummary("Постійні перенаправлення зі старих адрес");
        redirects.MapPost(string.Empty, CreateRedirectAsync)
            .WithName("AdminCreateRedirect")
            .WithSummary("Ручне перенаправлення");
        redirects.MapDelete("/{id:guid}", DeleteRedirectAsync)
            .WithName("AdminDeleteRedirect")
            .WithSummary("Видалення перенаправлення")
            .ProducesProblem(StatusCodes.Status404NotFound);

        return admin;
    }

    // ---------- Товари ----------

    private static async Task<Results<Ok<PagedResponse<AdminProductListItemDto>>, ValidationProblem>> ListProductsAsync(
        [AsParameters] AdminProductQuery query,
        PoliValkoDbContext db,
        CancellationToken ct)
    {
        var products = db.Set<Product>().AsNoTracking();
        switch (query.Stock?.Trim().ToLowerInvariant())
        {
            case null or "":
                break;
            case ProductStockFilters.In:
                products = products.Where(p => p.Stock.Quantity > 0);
                break;
            case ProductStockFilters.Low:
                products = products.Where(p => p.Stock.Quantity > 0 && p.Stock.Quantity <= ProductStockFilters.LowStockThreshold);
                break;
            case ProductStockFilters.Out:
                products = products.Where(p => p.Stock.Quantity <= 0);
                break;
            default:
                return TypedResults.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["stock"] = [$"Допустимі значення: {string.Join(", ", ProductStockFilters.All)}."],
                });
        }

        if (!string.IsNullOrWhiteSpace(query.Q))
        {
            var term = query.Q.Trim();
            var pattern = $"%{term.Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_")}%";
            products = products.Where(p => p.Sku == term
                || EF.Functions.ILike(p.Name, pattern, "\\")
                || (p.DisplayName != null && EF.Functions.ILike(p.DisplayName, pattern, "\\")));
        }

        if (query.CategoryId is { } categoryId)
        {
            products = products.Where(p => p.CategoryId == categoryId);
        }

        if (query.Visible is { } visible)
        {
            products = products.Where(p => p.IsVisible == visible);
        }

        var page = PageRequest.From(query.Page, query.PageSize);
        var total = await products.CountAsync(ct);
        var items = await ProjectListItemsAsync(db, products.OrderBy(p => p.DisplayName ?? p.Name).ThenBy(p => p.Id).Skip(page.Skip).Take(page.PageSize), ct);
        return TypedResults.Ok(PagedResponse<AdminProductListItemDto>.Create(items, page, total));
    }

    private static async Task<Results<Ok<SetProductsVisibilityResult>, ValidationProblem>> SetVisibilityAsync(
        SetProductsVisibilityRequest request,
        PoliValkoDbContext db,
        IAuditLog audit,
        IStorefrontCache storefront,
        TimeProvider time,
        CancellationToken ct)
    {
        var errors = new Dictionary<string, string[]>();
        var ids = (request.ProductIds ?? []).Distinct().ToList();
        if (ids.Count is 0 or > 200)
        {
            errors["productIds"] = ["Оберіть від 1 до 200 товарів."];
        }

        if (request.Visible is null)
        {
            errors["visible"] = ["Вкажіть, показати чи приховати товари."];
        }

        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var visible = request.Visible!.Value;
        var products = await db.Set<Product>().Where(p => ids.Contains(p.Id)).ToListAsync(ct);
        if (products.Count != ids.Count)
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["productIds"] = ["Частину товарів не знайдено."] });
        }

        var changed = products.Where(p => p.IsVisible != visible).ToList();
        if (changed.Count == 0)
        {
            return TypedResults.Ok(new SetProductsVisibilityResult(0));
        }

        var now = time.GetUtcNow();
        foreach (var product in changed)
        {
            product.IsVisible = visible;
            product.UpdatedAt = now;
        }

        // Один запис на всю дію: хто, коли й які артикули показав чи приховав.
        audit.Record("catalog.products_visibility_changed", "Product", null, new { visible, skus = changed.Select(p => p.Sku).ToList() });
        await db.SaveChangesAsync(ct);
        await storefront.InvalidateAsync(ProductTags([.. changed.Select(p => p.Slug)]), ct);

        return TypedResults.Ok(new SetProductsVisibilityResult(changed.Count));
    }

    private static async Task<Results<Ok<AdminProductDto>, ProblemHttpResult>> GetProductAsync(Guid id, PoliValkoDbContext db, CancellationToken ct)
    {
        var product = await LoadProductAsync(db, id, tracking: false, ct);
        return product is null ? ProductNotFound() : TypedResults.Ok(ToDto(product));
    }

    private static async Task<Results<Ok<AdminProductDto>, ValidationProblem, ProblemHttpResult>> UpdateProductAsync(
        Guid id,
        UpdateProductRequest request,
        PoliValkoDbContext db,
        IRichTextSanitizer sanitizer,
        IAuditLog audit,
        IStorefrontCache storefront,
        TimeProvider time,
        CancellationToken ct)
    {
        var product = await LoadProductAsync(db, id, tracking: true, ct);
        if (product is null)
        {
            return ProductNotFound();
        }

        var errors = new Dictionary<string, string[]>();
        var slug = string.IsNullOrWhiteSpace(request.Slug) ? product.Slug : request.Slug.Trim().ToLowerInvariant();
        if (!IsSlug(slug) || slug.Length > 300)
        {
            errors["slug"] = ["Адреса: латинські літери, цифри й дефіси, до 300 символів."];
        }
        else if (slug != product.Slug && await db.Set<Product>().AnyAsync(p => p.Slug == slug, ct))
        {
            errors["slug"] = ["Така адреса вже зайнята іншим товаром."];
        }

        var categoryId = request.CategoryId ?? product.CategoryId;
        if (!await db.Set<Category>().AnyAsync(c => c.Id == categoryId, ct))
        {
            errors["categoryId"] = ["Розділ не знайдено."];
        }

        CheckLength(errors, "displayName", request.DisplayName, 500);
        CheckLength(errors, "brand", request.Brand, 200);
        CheckLength(errors, "seoTitle", request.SeoTitle, 200);
        CheckLength(errors, "seoDescription", request.SeoDescription, 500);
        var description = sanitizer.Sanitize(request.DescriptionHtml);
        CheckLength(errors, "descriptionHtml", description, 20_000);
        var attributes = ValidateAttributes(request.Attributes, errors);

        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var before = new { product.DisplayName, product.Slug, product.CategoryId, product.Brand, product.IsVisible, product.SeoTitle, product.SeoDescription };
        var oldSlug = product.Slug;
        var now = time.GetUtcNow();

        product.DisplayName = NullIfEmpty(request.DisplayName);
        product.Slug = slug;
        product.CategoryId = categoryId;
        product.Brand = NullIfEmpty(request.Brand);
        product.DescriptionHtml = description;
        product.IsVisible = request.IsVisible;
        product.SeoTitle = NullIfEmpty(request.SeoTitle);
        product.SeoDescription = NullIfEmpty(request.SeoDescription);
        product.UpdatedAt = now;

        db.RemoveRange(product.Attributes);
        product.Attributes = attributes
            .Select((a, i) => new ProductAttribute { Id = Guid.CreateVersion7(now), ProductId = product.Id, Name = a.Name, Value = a.Value, SortOrder = i })
            .ToList();

        if (oldSlug != slug)
        {
            await AddRedirectAsync(db, $"/product/{oldSlug}", $"/product/{slug}", now, ct);
        }

        audit.Record("catalog.product_updated", "Product", product.Sku, new
        {
            before,
            after = new { product.DisplayName, product.Slug, product.CategoryId, product.Brand, product.IsVisible, product.SeoTitle, product.SeoDescription },
            attributes = attributes.Count,
        });
        await db.SaveChangesAsync(ct);
        await storefront.InvalidateAsync(ProductTags(oldSlug, slug), ct);

        return TypedResults.Ok(ToDto(product));
    }

    private static async Task<Results<Ok<AdminProductDto>, ValidationProblem, ProblemHttpResult>> UploadImageAsync(
        Guid id,
        IFormFile file,
        [FromForm] string? alt,
        PoliValkoDbContext db,
        IMediaStorage media,
        IAuditLog audit,
        IStorefrontCache storefront,
        TimeProvider time,
        CancellationToken ct)
    {
        var product = await LoadProductAsync(db, id, tracking: true, ct);
        if (product is null)
        {
            return ProductNotFound();
        }

        if (product.Images.Count >= 20)
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["file"] = ["Не більше 20 фото в товару."] });
        }

        StoredMedia stored;
        try
        {
            await using var stream = file.OpenReadStream();
            stored = await media.SaveImageAsync("products", stream, ct);
        }
        catch (MediaValidationException ex)
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["file"] = [ex.Message] });
        }

        var now = time.GetUtcNow();
        var image = new ProductImage
        {
            Id = Guid.CreateVersion7(now),
            ProductId = product.Id,
            Url = stored.Url,
            Alt = string.IsNullOrWhiteSpace(alt) ? product.DisplayName ?? product.Name : alt.Trim()[..Math.Min(alt.Trim().Length, 300)],
            SortOrder = product.Images.Count == 0 ? 0 : product.Images.Max(i => i.SortOrder) + 1,
        };
        db.Add(image);
        product.Images.Add(image);
        product.UpdatedAt = now;
        audit.Record("catalog.product_image_added", "Product", product.Sku, new { image.Url });
        await db.SaveChangesAsync(ct);
        await storefront.InvalidateAsync(ProductTags(product.Slug), ct);

        return TypedResults.Ok(ToDto(product));
    }

    private static async Task<Results<Ok<AdminProductDto>, ValidationProblem, ProblemHttpResult>> UpdateImagesAsync(
        Guid id,
        UpdateProductImagesRequest request,
        PoliValkoDbContext db,
        IStorefrontCache storefront,
        TimeProvider time,
        CancellationToken ct)
    {
        var product = await LoadProductAsync(db, id, tracking: true, ct);
        if (product is null)
        {
            return ProductNotFound();
        }

        var order = request.Images ?? [];
        if (order.Count != product.Images.Count || order.Select(i => i.Id).Distinct().Count() != order.Count
            || order.Any(i => product.Images.All(x => x.Id != i.Id)))
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["images"] = ["Передайте всі фото товару рівно один раз."] });
        }

        for (var i = 0; i < order.Count; i++)
        {
            var image = product.Images.Single(x => x.Id == order[i].Id);
            image.SortOrder = i;
            if (!string.IsNullOrWhiteSpace(order[i].Alt))
            {
                var altText = order[i].Alt!.Trim();
                image.Alt = altText.Length > 300 ? altText[..300] : altText;
            }
        }

        product.UpdatedAt = time.GetUtcNow();
        await db.SaveChangesAsync(ct);
        await storefront.InvalidateAsync(ProductTags(product.Slug), ct);
        return TypedResults.Ok(ToDto(product));
    }

    private static async Task<Results<Ok<AdminProductDto>, ProblemHttpResult>> DeleteImageAsync(
        Guid id,
        Guid imageId,
        PoliValkoDbContext db,
        IMediaStorage media,
        IAuditLog audit,
        IStorefrontCache storefront,
        TimeProvider time,
        CancellationToken ct)
    {
        var product = await LoadProductAsync(db, id, tracking: true, ct);
        var image = product?.Images.FirstOrDefault(i => i.Id == imageId);
        if (product is null || image is null)
        {
            return Problems.NotFound("catalog.image_not_found", "Фото не знайдено");
        }

        product.Images.Remove(image);
        db.Remove(image);
        product.UpdatedAt = time.GetUtcNow();
        audit.Record("catalog.product_image_deleted", "Product", product.Sku, new { image.Url });
        await db.SaveChangesAsync(ct);
        await media.DeleteAsync(image.Url, ct);
        await storefront.InvalidateAsync(ProductTags(product.Slug), ct);
        return TypedResults.Ok(ToDto(product));
    }

    private static async Task<Ok<List<AttributeNameDto>>> ListAttributeNamesAsync(Guid? categoryId, PoliValkoDbContext db, CancellationToken ct)
    {
        var attributes = db.Set<Product>().AsNoTracking();
        if (categoryId is { } id)
        {
            var categories = await db.Set<Category>().AsNoTracking().Select(c => new { c.Id, c.ParentId }).ToListAsync(ct);
            var ids = new HashSet<Guid> { id };
            for (var added = true; added;)
            {
                added = false;
                foreach (var c in categories.Where(c => c.ParentId is { } parent && ids.Contains(parent)))
                {
                    added |= ids.Add(c.Id);
                }
            }

            attributes = attributes.Where(p => ids.Contains(p.CategoryId));
        }

        var names = await attributes
            .SelectMany(p => p.Attributes)
            .GroupBy(a => a.Name)
            .Select(g => new AttributeNameDto(g.Key, g.Select(a => a.ProductId).Distinct().Count()))
            .OrderByDescending(a => a.ProductCount)
            .ThenBy(a => a.Name)
            .ToListAsync(ct);
        return TypedResults.Ok(names);
    }

    // ---------- Розділи ----------

    private static async Task<Ok<List<AdminCategoryDto>>> ListCategoriesAsync(PoliValkoDbContext db, CancellationToken ct)
    {
        var counts = await db.Set<Product>().GroupBy(p => p.CategoryId).Select(g => new { g.Key, Count = g.Count() }).ToDictionaryAsync(x => x.Key, x => x.Count, ct);
        var categories = await db.Set<Category>().AsNoTracking().OrderBy(c => c.SortOrder).ThenBy(c => c.Name).ToListAsync(ct);
        return TypedResults.Ok(categories.Select(c => ToDto(c, counts.GetValueOrDefault(c.Id))).ToList());
    }

    private static async Task<Results<Created<AdminCategoryDto>, ValidationProblem>> CreateCategoryAsync(
        SaveCategoryRequest request,
        PoliValkoDbContext db,
        IAuditLog audit,
        IStorefrontCache storefront,
        CancellationToken ct)
    {
        var errors = new Dictionary<string, string[]>();
        if (request.ParentId is null)
        {
            errors["parentId"] = ["Оберіть батьківський розділ: верхній рівень відповідає групам Navkolo."];
        }

        var category = new Category { Id = Guid.CreateVersion7(), Name = string.Empty, Slug = string.Empty };
        await ApplyCategoryAsync(category, request, isNew: true, db, errors, ct);
        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        db.Add(category);
        audit.Record("catalog.category_created", "Category", category.Slug, new { category.Name, category.ParentId, category.NavkoloRef });
        await db.SaveChangesAsync(ct);
        await storefront.InvalidateAsync([StorefrontTags.Catalog, StorefrontTags.Categories], ct);
        return TypedResults.Created($"/api/v1/admin/catalog/categories/{category.Id}", ToDto(category, 0));
    }

    private static async Task<Results<Ok<AdminCategoryDto>, ValidationProblem, ProblemHttpResult>> UpdateCategoryAsync(
        Guid id,
        SaveCategoryRequest request,
        PoliValkoDbContext db,
        IAuditLog audit,
        IStorefrontCache storefront,
        TimeProvider time,
        CancellationToken ct)
    {
        var category = await db.Set<Category>().FirstOrDefaultAsync(c => c.Id == id, ct);
        if (category is null)
        {
            return CategoryNotFound();
        }

        var errors = new Dictionary<string, string[]>();
        if (category.ParentId is null && request.ParentId is not null)
        {
            errors["parentId"] = ["Розділ верхнього рівня не можна перенести: він відповідає групі Navkolo."];
        }
        else if (category.ParentId is not null && request.ParentId is null)
        {
            errors["parentId"] = ["Підрозділ має залишатися в одному з розділів."];
        }

        var before = new { category.Name, category.Slug, category.ParentId, category.IsVisible, category.NavkoloRef, category.SortOrder };
        var oldSlug = category.Slug;
        await ApplyCategoryAsync(category, request, isNew: false, db, errors, ct);
        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        if (oldSlug != category.Slug)
        {
            await AddRedirectAsync(db, $"/catalog/{oldSlug}", $"/catalog/{category.Slug}", time.GetUtcNow(), ct);
        }

        audit.Record("catalog.category_updated", "Category", category.Slug, new
        {
            before,
            after = new { category.Name, category.Slug, category.ParentId, category.IsVisible, category.NavkoloRef, category.SortOrder },
            category.FilterAttributes,
        });
        await db.SaveChangesAsync(ct);
        await storefront.InvalidateAsync([StorefrontTags.Catalog, StorefrontTags.Categories, StorefrontTags.Products], ct);

        var count = await db.Set<Product>().CountAsync(p => p.CategoryId == id, ct);
        return TypedResults.Ok(ToDto(category, count));
    }

    private static async Task<Results<NoContent, ProblemHttpResult>> DeleteCategoryAsync(
        Guid id,
        PoliValkoDbContext db,
        IAuditLog audit,
        IStorefrontCache storefront,
        CancellationToken ct)
    {
        var category = await db.Set<Category>().FirstOrDefaultAsync(c => c.Id == id, ct);
        if (category is null)
        {
            return CategoryNotFound();
        }

        if (category.ParentId is null)
        {
            return Problems.Create(StatusCodes.Status409Conflict, "catalog.category_top_level", "Розділ верхнього рівня не видаляється", "Його можна приховати.");
        }

        if (await db.Set<Category>().AnyAsync(c => c.ParentId == id, ct) || await db.Set<Product>().AnyAsync(p => p.CategoryId == id, ct))
        {
            return Problems.Create(StatusCodes.Status409Conflict, "catalog.category_not_empty", "Розділ не порожній", "Спочатку перенесіть товари й підрозділи.");
        }

        db.Remove(category);
        audit.Record("catalog.category_deleted", "Category", category.Slug, new { category.Name });
        await db.SaveChangesAsync(ct);
        await storefront.InvalidateAsync([StorefrontTags.Catalog, StorefrontTags.Categories], ct);
        return TypedResults.NoContent();
    }

    private static async Task ApplyCategoryAsync(
        Category category,
        SaveCategoryRequest request,
        bool isNew,
        PoliValkoDbContext db,
        Dictionary<string, string[]> errors,
        CancellationToken ct)
    {
        // Верхній рівень лишається верхнім; підрозділ завжди має батька (перевірено викликом).
        var isSubcategory = isNew || category.ParentId is not null;
        var name = request.Name?.Trim();
        if (string.IsNullOrEmpty(name) || name.Length > 200)
        {
            errors["name"] = ["Вкажіть назву до 200 символів."];
        }

        var slug = string.IsNullOrWhiteSpace(request.Slug) ? Transliteration.ToSlug(name ?? string.Empty) : request.Slug.Trim().ToLowerInvariant();
        if (!IsSlug(slug) || slug.Length > 200)
        {
            errors["slug"] = ["Адреса: латинські літери, цифри й дефіси, до 200 символів."];
        }
        else if (await db.Set<Category>().AnyAsync(c => c.Slug == slug && c.Id != category.Id, ct))
        {
            errors["slug"] = ["Така адреса вже зайнята іншим розділом."];
        }

        if (isSubcategory && request.ParentId is { } parentId)
        {
            var parent = await db.Set<Category>().AsNoTracking().FirstOrDefaultAsync(c => c.Id == parentId, ct);
            if (parent is null)
            {
                errors["parentId"] = ["Батьківський розділ не знайдено."];
            }
            else if (parent.Id == category.Id || await IsDescendantAsync(db, parent.Id, category.Id, ct))
            {
                errors["parentId"] = ["Розділ не можна вкласти сам у себе."];
            }
        }

        CheckLength(errors, "navkoloRef", request.NavkoloRef, 100);
        CheckLength(errors, "seoTitle", request.SeoTitle, 200);
        CheckLength(errors, "seoDescription", request.SeoDescription, 500);
        var filters = (request.FilterAttributes ?? [])
            .Where(f => !string.IsNullOrWhiteSpace(f))
            .Select(f => f.Trim())
            .Distinct(StringComparer.Ordinal)
            .ToList();
        if (filters.Count > 10 || filters.Any(f => f.Length > 100))
        {
            errors["filterAttributes"] = ["До 10 характеристик, кожна до 100 символів."];
        }

        if (errors.Count > 0)
        {
            return;
        }

        category.Name = name!;
        category.Slug = slug;
        if (isSubcategory)
        {
            category.ParentId = request.ParentId;
        }

        category.SortOrder = request.SortOrder;
        category.IsVisible = request.IsVisible;
        category.NavkoloRef = NullIfEmpty(request.NavkoloRef);
        category.FilterAttributes = filters;
        category.SeoTitle = NullIfEmpty(request.SeoTitle);
        category.SeoDescription = NullIfEmpty(request.SeoDescription);
    }

    /// <summary>Чи є <paramref name="candidate"/> нащадком <paramref name="ancestor"/>.</summary>
    private static async Task<bool> IsDescendantAsync(PoliValkoDbContext db, Guid candidate, Guid ancestor, CancellationToken ct)
    {
        var parents = await db.Set<Category>().AsNoTracking().ToDictionaryAsync(c => c.Id, c => c.ParentId, ct);
        for (var current = parents.GetValueOrDefault(candidate); current is { } id; current = parents.GetValueOrDefault(id))
        {
            if (id == ancestor)
            {
                return true;
            }
        }

        return false;
    }

    // ---------- Добірки ----------

    private static async Task<Ok<List<AdminCollectionDto>>> ListCollectionsAsync(PoliValkoDbContext db, CancellationToken ct)
    {
        var collections = await db.Set<HomeCollection>().AsNoTracking().OrderBy(c => c.SortOrder).ThenBy(c => c.Title).ToListAsync(ct);
        var products = await LoadListItemsAsync(db, collections.SelectMany(c => c.ProductIds), ct);
        return TypedResults.Ok(collections.Select(c => ToDto(c, products)).ToList());
    }

    private static async Task<Results<Created<AdminCollectionDto>, ValidationProblem>> CreateCollectionAsync(
        SaveCollectionRequest request,
        PoliValkoDbContext db,
        IAuditLog audit,
        IStorefrontCache storefront,
        CancellationToken ct)
    {
        var collection = new HomeCollection { Id = Guid.CreateVersion7(), Code = string.Empty, Title = string.Empty };
        var errors = await ApplyCollectionAsync(collection, request, db, ct);
        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        db.Add(collection);
        audit.Record("catalog.collection_created", "Collection", collection.Code, new { collection.Title, products = collection.ProductIds.Count });
        await db.SaveChangesAsync(ct);
        await storefront.InvalidateAsync([StorefrontTags.Collections], ct);
        var products = await LoadListItemsAsync(db, collection.ProductIds, ct);
        return TypedResults.Created($"/api/v1/admin/catalog/collections/{collection.Id}", ToDto(collection, products));
    }

    private static async Task<Results<Ok<AdminCollectionDto>, ValidationProblem, ProblemHttpResult>> UpdateCollectionAsync(
        Guid id,
        SaveCollectionRequest request,
        PoliValkoDbContext db,
        IAuditLog audit,
        IStorefrontCache storefront,
        CancellationToken ct)
    {
        var collection = await db.Set<HomeCollection>().FirstOrDefaultAsync(c => c.Id == id, ct);
        if (collection is null)
        {
            return Problems.NotFound("catalog.collection_not_found", "Добірку не знайдено");
        }

        var errors = await ApplyCollectionAsync(collection, request, db, ct);
        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        audit.Record("catalog.collection_updated", "Collection", collection.Code, new { collection.Title, collection.IsVisible, products = collection.ProductIds.Count });
        await db.SaveChangesAsync(ct);
        await storefront.InvalidateAsync([StorefrontTags.Collections], ct);
        var products = await LoadListItemsAsync(db, collection.ProductIds, ct);
        return TypedResults.Ok(ToDto(collection, products));
    }

    private static async Task<Results<NoContent, ProblemHttpResult>> DeleteCollectionAsync(
        Guid id,
        PoliValkoDbContext db,
        IAuditLog audit,
        IStorefrontCache storefront,
        CancellationToken ct)
    {
        var collection = await db.Set<HomeCollection>().FirstOrDefaultAsync(c => c.Id == id, ct);
        if (collection is null)
        {
            return Problems.NotFound("catalog.collection_not_found", "Добірку не знайдено");
        }

        db.Remove(collection);
        audit.Record("catalog.collection_deleted", "Collection", collection.Code, new { collection.Title });
        await db.SaveChangesAsync(ct);
        await storefront.InvalidateAsync([StorefrontTags.Collections], ct);
        return TypedResults.NoContent();
    }

    private static async Task<Dictionary<string, string[]>> ApplyCollectionAsync(
        HomeCollection collection,
        SaveCollectionRequest request,
        PoliValkoDbContext db,
        CancellationToken ct)
    {
        var errors = new Dictionary<string, string[]>();
        var code = request.Code?.Trim().ToLowerInvariant() ?? string.Empty;
        if (!IsSlug(code) || code.Length > 50)
        {
            errors["code"] = ["Код: латинські літери, цифри й дефіси, до 50 символів."];
        }
        else if (await db.Set<HomeCollection>().AnyAsync(c => c.Code == code && c.Id != collection.Id, ct))
        {
            errors["code"] = ["Добірка з таким кодом уже є."];
        }

        var title = request.Title?.Trim();
        if (string.IsNullOrEmpty(title) || title.Length > 200)
        {
            errors["title"] = ["Вкажіть назву до 200 символів."];
        }

        var ids = (request.ProductIds ?? []).Distinct().ToList();
        if (ids.Count > 24)
        {
            errors["productIds"] = ["Не більше 24 товарів у добірці."];
        }
        else if (ids.Count > 0 && await db.Set<Product>().CountAsync(p => ids.Contains(p.Id), ct) != ids.Count)
        {
            errors["productIds"] = ["Частину товарів не знайдено."];
        }

        if (errors.Count == 0)
        {
            collection.Code = code;
            collection.Title = title!;
            collection.SortOrder = request.SortOrder;
            collection.IsVisible = request.IsVisible;
            collection.ProductIds = ids;
        }

        return errors;
    }

    // ---------- Перенаправлення ----------

    private static async Task<Ok<List<AdminRedirectDto>>> ListRedirectsAsync(PoliValkoDbContext db, CancellationToken ct) =>
        TypedResults.Ok(await db.Set<UrlRedirect>()
            .AsNoTracking()
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => new AdminRedirectDto(r.Id, r.FromPath, r.ToPath, r.IsAutomatic, r.CreatedAt))
            .ToListAsync(ct));

    private static async Task<Results<Created<AdminRedirectDto>, ValidationProblem>> CreateRedirectAsync(
        CreateRedirectRequest request,
        PoliValkoDbContext db,
        IAuditLog audit,
        TimeProvider time,
        CancellationToken ct)
    {
        var errors = new Dictionary<string, string[]>();
        var from = NormalizePath(request.FromPath);
        var to = NormalizePath(request.ToPath);
        if (from is null)
        {
            errors["fromPath"] = ["Вкажіть шлях без домену, що починається з /, напр. /product/stara-adresa."];
        }

        if (to is null)
        {
            errors["toPath"] = ["Вкажіть шлях без домену, що починається з /."];
        }
        else if (from == to)
        {
            errors["toPath"] = ["Нова адреса збігається зі старою."];
        }

        if (from is not null && await db.Set<UrlRedirect>().AnyAsync(r => r.FromPath == from, ct))
        {
            errors["fromPath"] = ["Для цієї адреси вже є перенаправлення."];
        }

        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var redirect = new UrlRedirect { Id = Guid.CreateVersion7(), FromPath = from!, ToPath = to!, CreatedAt = time.GetUtcNow() };
        db.Add(redirect);
        audit.Record("catalog.redirect_created", "Redirect", from, new { to });
        await db.SaveChangesAsync(ct);
        return TypedResults.Created($"/api/v1/admin/catalog/redirects/{redirect.Id}", new AdminRedirectDto(redirect.Id, redirect.FromPath, redirect.ToPath, false, redirect.CreatedAt));
    }

    private static async Task<Results<NoContent, ProblemHttpResult>> DeleteRedirectAsync(Guid id, PoliValkoDbContext db, IAuditLog audit, CancellationToken ct)
    {
        var redirect = await db.Set<UrlRedirect>().FirstOrDefaultAsync(r => r.Id == id, ct);
        if (redirect is null)
        {
            return Problems.NotFound("catalog.redirect_not_found", "Перенаправлення не знайдено");
        }

        db.Remove(redirect);
        audit.Record("catalog.redirect_deleted", "Redirect", redirect.FromPath, new { redirect.ToPath });
        await db.SaveChangesAsync(ct);
        return TypedResults.NoContent();
    }

    /// <summary>
    /// Стара адреса веде на нову; наявні перенаправлення на стару адресу теж переводяться на нову,
    /// щоб не було ланцюжків. Якщо нова адреса колись була старою, її перенаправлення знімається.
    /// </summary>
    internal static async Task AddRedirectAsync(PoliValkoDbContext db, string from, string to, DateTimeOffset now, CancellationToken ct)
    {
        await db.Set<UrlRedirect>().Where(r => r.FromPath == to).ExecuteDeleteAsync(ct);
        await db.Set<UrlRedirect>().Where(r => r.ToPath == from).ExecuteUpdateAsync(s => s.SetProperty(r => r.ToPath, to), ct);
        if (!await db.Set<UrlRedirect>().AnyAsync(r => r.FromPath == from, ct))
        {
            db.Add(new UrlRedirect { Id = Guid.CreateVersion7(now), FromPath = from, ToPath = to, IsAutomatic = true, CreatedAt = now });
        }
    }

    // ---------- Допоміжне ----------

    private static Task<Product?> LoadProductAsync(PoliValkoDbContext db, Guid id, bool tracking, CancellationToken ct)
    {
        var query = db.Set<Product>()
            .Include(p => p.Price)
            .Include(p => p.Stock)
            .Include(p => p.Images)
            .Include(p => p.Attributes)
            .AsSplitQuery();
        return (tracking ? query : query.AsNoTracking()).FirstOrDefaultAsync(p => p.Id == id, ct);
    }

    private sealed record ListRow(
        Guid Id,
        string Sku,
        string Name,
        string? DisplayName,
        string Slug,
        string CategoryName,
        decimal Price,
        decimal Stock,
        bool IsVisible,
        string? ImageUrl,
        bool HasDescription,
        DateTimeOffset UpdatedAt)
    {
        public AdminProductListItemDto ToDto() =>
            new(Id, Sku, Name, DisplayName, Slug, CategoryName, MoneyDto.Hryvnia(Price), Stock, IsVisible, ImageUrl, HasDescription, UpdatedAt);
    }

    private static async Task<List<AdminProductListItemDto>> ProjectListItemsAsync(PoliValkoDbContext db, IQueryable<Product> products, CancellationToken ct)
    {
        var rows = await products
            .Join(db.Set<Category>(), p => p.CategoryId, c => c.Id, (p, c) => new ListRow(
                p.Id,
                p.Sku,
                p.Name,
                p.DisplayName,
                p.Slug,
                c.Name,
                p.Price.Amount,
                p.Stock.Quantity,
                p.IsVisible,
                p.Images.OrderBy(i => i.SortOrder).Select(i => i.Url).FirstOrDefault(),
                p.DescriptionHtml != null,
                p.UpdatedAt))
            .ToListAsync(ct);
        return rows.Select(r => r.ToDto()).ToList();
    }

    private static async Task<Dictionary<Guid, AdminProductListItemDto>> LoadListItemsAsync(PoliValkoDbContext db, IEnumerable<Guid> ids, CancellationToken ct)
    {
        var list = ids.Distinct().ToList();
        if (list.Count == 0)
        {
            return [];
        }

        var rows = await ProjectListItemsAsync(db, db.Set<Product>().AsNoTracking().Where(p => list.Contains(p.Id)), ct);
        return rows.ToDictionary(r => r.Id);
    }

    private static AdminProductDto ToDto(Product p) => new(
        p.Id,
        new NavkoloProductFieldsDto(
            p.NavkoloId,
            p.Sku,
            p.Name,
            p.NavkoloGroupRef,
            MoneyDto.Hryvnia(p.Price.Amount),
            p.Price.OldAmount is { } old ? MoneyDto.Hryvnia(old) : null,
            p.Stock.Quantity,
            p.Price.UpdatedAt,
            p.Stock.UpdatedAt,
            p.VariantGroup,
            p.VariantLabel),
        p.DisplayName,
        p.Slug,
        p.CategoryId,
        p.Brand,
        p.DescriptionHtml,
        p.IsVisible,
        p.SeoTitle,
        p.SeoDescription,
        p.Attributes.OrderBy(a => a.SortOrder).Select(a => new ProductAttributeDto(a.Name, a.Value)).ToList(),
        p.Images.OrderBy(i => i.SortOrder).Select(i => new AdminProductImageDto(i.Id, i.Url, i.Alt, i.SortOrder, i.Credit)).ToList(),
        p.UpdatedAt);

    private static AdminCategoryDto ToDto(Category c, int productCount) => new(
        c.Id, c.ParentId, c.Slug, c.Name, c.SortOrder, c.IsVisible, c.NavkoloRef, c.FilterAttributes ?? [], c.SeoTitle, c.SeoDescription, productCount);

    private static AdminCollectionDto ToDto(HomeCollection c, Dictionary<Guid, AdminProductListItemDto> products) => new(
        c.Id, c.Code, c.Title, c.SortOrder, c.IsVisible, c.ProductIds.Where(products.ContainsKey).Select(id => products[id]).ToList());

    private static List<ProductAttributeDto> ValidateAttributes(IReadOnlyList<ProductAttributeDto>? attributes, Dictionary<string, string[]> errors)
    {
        var list = (attributes ?? [])
            .Select(a => new ProductAttributeDto(a.Name?.Trim() ?? string.Empty, a.Value?.Trim() ?? string.Empty))
            .Where(a => a.Name.Length > 0 || a.Value.Length > 0)
            .ToList();
        if (list.Count > 50)
        {
            errors["attributes"] = ["Не більше 50 характеристик."];
        }
        else if (list.Any(a => a.Name.Length is 0 or > 100 || a.Value.Length is 0 or > 300))
        {
            errors["attributes"] = ["У кожної характеристики має бути назва до 100 символів і значення до 300."];
        }
        else if (list.Select(a => a.Name).Distinct(StringComparer.OrdinalIgnoreCase).Count() != list.Count)
        {
            errors["attributes"] = ["Назви характеристик не повинні повторюватися."];
        }

        return list;
    }

    private static void CheckLength(Dictionary<string, string[]> errors, string field, string? value, int max)
    {
        if (value is { } v && v.Trim().Length > max)
        {
            errors[field] = [$"Не більше {max} символів."];
        }
    }

    private static string? NullIfEmpty(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static string? NormalizePath(string? value)
    {
        var path = value?.Trim();
        return path is { Length: > 1 and <= 500 } && path.StartsWith('/') && !path.StartsWith("//", StringComparison.Ordinal) && !path.Contains("://", StringComparison.Ordinal)
            ? path.TrimEnd('/')
            : null;
    }

    private static bool IsSlug(string value) => SlugPattern().IsMatch(value);

    private static string[] ProductTags(params string[] slugs) =>
        [StorefrontTags.Products, StorefrontTags.Collections, .. slugs.Distinct().Select(StorefrontTags.Product)];

    private static ProblemHttpResult ProductNotFound() => Problems.NotFound("catalog.product_not_found", "Товар не знайдено");

    private static ProblemHttpResult CategoryNotFound() => Problems.NotFound("catalog.category_not_found", "Розділ не знайдено");

    [GeneratedRegex("^[a-z0-9]+(?:-[a-z0-9]+)*$")]
    private static partial Regex SlugPattern();
}

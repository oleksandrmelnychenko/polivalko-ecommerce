using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Domain;

namespace PoliValko.IntegrationTests;

/// <summary>
/// Sections, products and till receipts for the tests of the season. The sections are hidden and given to the code
/// under test directly, so the shop the other tests look at gains neither departments nor products.
/// </summary>
internal static class SeasonData
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    public static async Task<Category> AddCategoryAsync(this ApiFactory api, Guid? parent = null, string name = "Полиця сезону")
    {
        var category = new Category { Id = Guid.NewGuid(), ParentId = parent, Slug = "season-" + Guid.NewGuid(), Name = name, IsVisible = false };
        await api.WithDbAsync(db => { db.Add(category); return db.SaveChangesAsync(Ct); });
        return category;
    }

    /// <summary>A product the till knows, so that receipts can name it.</summary>
    public static async Task<Product> AddSoldProductAsync(this ApiFactory api, Category category, string name, decimal stock = 5)
    {
        var product = await api.AddProductAsync(category.Slug, name, 100, stock);
        await api.WithDbAsync(db => db.Set<Product>().Where(p => p.Id == product.Id)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.NavkoloId, "dntrade-code:" + product.Id), Ct));
        return product;
    }

    public static Task AddReceiptsAsync(this ApiFactory api, Product product, DateOnly day, int count) =>
        api.AddDailyReceiptsAsync(product, day, day, count);

    public static Task AddDailyReceiptsAsync(this ApiFactory api, Product product, DateOnly from, DateOnly to, int perDay = 1)
    {
        var code = product.Id.ToString();
        return api.WithDbAsync(db => db.Database.ExecuteSqlAsync($"""
            INSERT INTO accounting.documents(id,source_account,source_id,entity_type,kind,day,status,store_ids,total,details)
            SELECT gen_random_uuid(),'valko-dntrade',gen_random_uuid()::text,'receipt','cash',day::date,'active',ARRAY[]::text[],100,
                jsonb_build_object('products',jsonb_build_array(jsonb_build_object('product',
                    jsonb_build_object('code',{code}),'quantity',1)))
            FROM generate_series({from}::timestamp,{to}::timestamp,interval '1 day') day CROSS JOIN generate_series(1,{perDay})
            """, Ct));
    }
}

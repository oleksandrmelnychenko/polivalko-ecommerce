using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Domain;
using PoliValko.Customers.Contracts;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Catalog.Features.Favorites;

internal sealed class CustomerFavoritesCounter(PoliValkoDbContext db) : ICustomerFavoritesCounter
{
    public Task<int> CountFavoritesAsync(Guid customerId, CancellationToken ct) =>
        db.Set<Favorite>().CountAsync(f => f.CustomerId == customerId, ct);
}

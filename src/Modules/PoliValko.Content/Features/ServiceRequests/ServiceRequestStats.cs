using Microsoft.EntityFrameworkCore;
using PoliValko.Content.Contracts;
using PoliValko.Content.Domain;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Content.Features.ServiceRequests;

internal sealed class ServiceRequestStats(PoliValkoDbContext db) : IServiceRequestStats
{
    public Task<int> CountNewAsync(CancellationToken ct) =>
        db.Set<ServiceRequest>().CountAsync(r => r.Status == ServiceRequestStatus.New, ct);
}

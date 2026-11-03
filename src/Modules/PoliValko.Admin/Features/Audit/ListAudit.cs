using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Persistence;
using PoliValko.SharedKernel;

namespace PoliValko.Admin.Features.Audit;

internal static class ListAudit
{
    public static async Task<Ok<PagedResponse<AuditEntryDto>>> HandleAsync([AsParameters] AuditQuery query, PoliValkoDbContext db, CancellationToken ct)
    {
        var entries = db.Set<AuditEntry>().AsNoTracking();
        if (!string.IsNullOrWhiteSpace(query.EntityType))
        {
            entries = entries.Where(e => e.EntityType == query.EntityType);
        }

        if (!string.IsNullOrWhiteSpace(query.Q))
        {
            var term = query.Q.Trim();
            entries = entries.Where(e => e.EntityId == term || e.Actor.Contains(term) || e.Action.Contains(term));
        }

        var page = PageRequest.From(query.Page, query.PageSize);
        var total = await entries.CountAsync(ct);
        var rows = await entries.OrderByDescending(e => e.At).Skip(page.Skip).Take(page.PageSize).ToListAsync(ct);
        var items = rows.Select(e => new AuditEntryDto(
                e.Id,
                e.At,
                e.Actor,
                e.Action,
                e.EntityType,
                e.EntityId,
                e.Details is null ? null : JsonDocument.Parse(e.Details).RootElement.Clone()))
            .ToList();
        return TypedResults.Ok(PagedResponse<AuditEntryDto>.Create(items, page, total));
    }
}

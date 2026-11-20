using System.Text.Json.Serialization;

namespace PoliValko.Navkolo.Features.WorkForms;

public sealed record DnTradeWorkFormLine(
    string? Sku = null, string? Description = null, string? Unit = null,
    string? Quantity = null, string? ExpectedQuantity = null, string? UnitPrice = null);

public sealed record DnTradeWorkFormData(
    string? Number = null, string? Organization = null, string? Counterparty = null,
    string? Warehouse = null, string? DestinationWarehouse = null, string? Account = null,
    string? Direction = null, string? Currency = null, string? Amount = null,
    string? Name = null, string? Code = null, string? ReferenceKind = null, string? Phone = null,
    string? Email = null, string? Note = null, IReadOnlyList<DnTradeWorkFormLine>? Lines = null);

public sealed record SaveDnTradeWorkFormRequest(
    [property: JsonRequired] int? ExpectedVersion,
    string Section, string Type, string Status, string Title, DateOnly? DocumentDate,
    Guid? SourceRecordId, DnTradeWorkFormData Data);

public sealed record DnTradeWorkFormItemDto(Guid Id, int Version, string Section, string Type, string Status,
    string Title, DateOnly? DocumentDate, Guid? SourceRecordId, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt);

public sealed record DnTradeWorkFormDto(Guid Id, int Version, string Section, string Type, string Status,
    string Title, DateOnly? DocumentDate, Guid? SourceRecordId, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt, DnTradeWorkFormData Data);

public sealed record DnTradeWorkFormPageDto(IReadOnlyList<DnTradeWorkFormItemDto> Items, int Page, int PageSize, int TotalItems);

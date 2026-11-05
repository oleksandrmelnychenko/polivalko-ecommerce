namespace PoliValko.Content.Features.ServiceRequests;

public sealed record ServiceDirectionDto(string Code, string Name, string? Description, string? ImageUrl);

public sealed record CreateServiceRequest(string? Name, string? Phone, string? Direction, string? Comment);

public sealed record ServiceRequestCreated(Guid Id);

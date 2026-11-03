using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.Extensions.Options;
using PoliValko.Ordering.Configuration;

namespace PoliValko.Ordering.Features.Checkout;

internal static class GetSeller
{
    public static Ok<SellerDto> Handle(IOptions<SellerOptions> seller) =>
        TypedResults.Ok(new SellerDto(seller.Value.Name, seller.Value.TaxId, seller.Value.Address));
}

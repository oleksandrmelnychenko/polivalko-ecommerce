import { InfoPage } from "./info-page";
import { SellerDetails } from "./seller-details";

export function OfferScreen() {
  return (
    <InfoPage slug="offer" layout="rows">
      <SellerDetails />
    </InfoPage>
  );
}

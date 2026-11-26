import { InfoPage } from "./info-page";
import { SellerDetails } from "./seller-details";

export function OfferScreen() {
  return (
    <InfoPage
      slug="offer"
      title="Публічна оферта"
      lead="На яких умовах ви купуєте товари?"
      layout="offer"
    >
      <SellerDetails />
    </InfoPage>
  );
}

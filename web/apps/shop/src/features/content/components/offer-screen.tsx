import { InfoPage } from "./info-page";
import { SellerDetails } from "./seller-details";

export function OfferScreen() {
  return (
    <InfoPage slug="offer" title="Публічна оферта" lead="Договір купівлі-продажу між продавцем і покупцем інтернет-магазину." layout="rows">
      <SellerDetails />
    </InfoPage>
  );
}

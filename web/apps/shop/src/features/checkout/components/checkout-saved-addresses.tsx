import { addressPlace, addressTitle, type CustomerAddress } from "@/features/customer";

export function CheckoutSavedAddresses({ addresses, chosen, choose }: { addresses: CustomerAddress[]; chosen: string; choose: (id: string) => void }) {
  return (
    <fieldset className="seg--cards address-choice">
      <legend>Мої адреси</legend>
      {addresses.map((a) => (
        <span key={a.id}>
          <input type="radio" id={`saved-${a.id}`} name="savedAddress" value={a.id} checked={chosen === a.id} onChange={() => choose(a.id)} />
          <label htmlFor={`saved-${a.id}`}>
            <b>{addressTitle(a)}</b>
            <small>
              {a.settlementName}, {addressPlace(a)}
            </small>
          </label>
        </span>
      ))}
      <span>
        <input type="radio" id="saved-new" name="savedAddress" value="new" checked={chosen === "new"} onChange={() => choose("new")} />
        <label htmlFor="saved-new">
          <b>Інша адреса</b>
          <small>Заповнити вручну</small>
        </label>
      </span>
    </fieldset>
  );
}

export function ContactsPhone({ value }: { value: string }) {
  return (
    <p>
      <a className="link" href={`tel:${value.replace(/[^\d+]/g, "")}`}>
        {value}
      </a>
    </p>
  );
}

export function FormStatus({ form }: { form: { error: string | null; done: string | null } }) {
  if (form.error)
    return (
      <p className="notice notice--error" role="alert">
        {form.error}
      </p>
    );
  if (form.done)
    return (
      <p className="notice notice--ok" role="status">
        {form.done}
      </p>
    );
  return null;
}

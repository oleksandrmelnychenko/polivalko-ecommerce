export function withNext(path: string, params: { get(name: string): string | null }): string {
  const query = new URLSearchParams();
  for (const key of ["next", "reason"]) {
    const value = params.get(key);
    if (value) query.set(key, value);
  }
  const suffix = query.toString();
  return suffix ? `${path}?${suffix}` : path;
}

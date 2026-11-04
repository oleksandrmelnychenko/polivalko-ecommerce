export function nextPath(next: string | null): string {
  return next && /^\/(?![/\\])/.test(next) ? next : "/";
}

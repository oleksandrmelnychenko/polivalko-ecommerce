export function loaded<T>(result: { data?: T; response: Response }, what: string): T | null {
  if (result.data !== undefined) return result.data;
  if (result.response.status === 404) return null;
  throw new Error(`API: не вдалося завантажити ${what}, статус ${result.response.status}`);
}

export const share = (n: number, total: number) => (total ? `${Math.round((n / total) * 100)}%` : "");

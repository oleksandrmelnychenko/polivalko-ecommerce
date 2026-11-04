export type Errors = Record<string, string | undefined>;

export type Notice = { kind: "error" | "info"; title: string; text?: string; items?: string[] };

export type CourierPrefill = { key: number; values: { street: string; house: string; apartment: string | null } | null };

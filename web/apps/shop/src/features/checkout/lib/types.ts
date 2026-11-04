export type Errors = Record<string, string | undefined>;

export type Notice = { kind: "error" | "info"; title: string; text?: string; items?: string[] };

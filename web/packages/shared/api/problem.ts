export type Problem = {
  title?: string;
  detail?: string;
  code?: string;
  errors?: Record<string, string[]>;
  [extension: string]: unknown;
};

export const problemOf = (result: { error?: unknown }) => result.error as Problem | undefined;

export function problemText(problem: Problem | undefined, fallback: string): string {
  if (!problem?.title) return fallback;
  return problem.detail ? `${problem.title}. ${problem.detail}` : problem.title;
}

export function problemTitle(error: unknown, fallback: string) {
  return (error as Problem | undefined)?.title ?? fallback;
}

export function fieldErrors(error: unknown): Record<string, string> {
  const problem = error as Problem | undefined;
  return Object.fromEntries(Object.entries(problem?.errors ?? {}).map(([k, v]) => [k, v[0]]));
}

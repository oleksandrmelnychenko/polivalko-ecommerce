"use client";

import { useState } from "react";
import { withCsrf, type CsrfHeaders } from "@/shared/csrf";
import { problemOf, problemText } from "@polivalko/shared/api/problem";

type FormState = { busy: boolean; errors: Record<string, string[]>; error: string | null; done: string | null };

const idle: FormState = { busy: false, errors: {}, error: null, done: null };
const checkFields = "Перевірте виділені поля.";

export function useConsoleForm() {
  const [state, setState] = useState<FormState>(idle);

  async function submit<R extends { error?: unknown; response: Response }>(
    send: (headers: CsrfHeaders) => Promise<R>,
    messages: { done: string; failed: string },
  ): Promise<R | null> {
    setState({ ...idle, busy: true });
    try {
      const result = await withCsrf(send);
      if (result.response.ok) {
        setState({ ...idle, done: messages.done });
        return result;
      }
      const problem = problemOf(result);
      setState({ ...idle, errors: problem?.errors ?? {}, error: problem?.errors ? checkFields : problemText(problem, messages.failed) });
    } catch {
      setState({ ...idle, error: "Немає зв'язку з сервером. Спробуйте ще раз." });
    }
    return null;
  }

  return {
    ...state,
    submit,
    invalid: (errors: Record<string, string[]>) => setState({ ...idle, errors, error: checkFields }),
  };
}

"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { expireOn401 } from "@/features/customer";
import { fieldErrors } from "@polivalko/shared/api/problem";
import { failureStatus, offline, type Status } from "../lib/form-status";

export function useFormState(formRef: RefObject<HTMLFormElement | null>) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState(false);
  const focusInvalid = useRef(false);

  useEffect(() => {
    if (!focusInvalid.current) return;
    focusInvalid.current = false;
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [errors, formRef]);

  async function submit<R extends { error?: unknown; response: Response }>(send: () => Promise<R>): Promise<R | null> {
    setBusy(true);
    setStatus(null);
    setErrors({});
    try {
      const result = expireOn401(await send());
      if (!result.response.ok) {
        focusInvalid.current = true;
        setErrors(fieldErrors(result.error));
        setStatus(failureStatus(result.response, result.error));
      }
      return result;
    } catch {
      setStatus(offline);
      return null;
    } finally {
      setBusy(false);
    }
  }

  return { errors, status, setStatus, busy, submit };
}

"use client";

import { useCallback, useEffect, useEffectEvent, useState } from "react";
import { expireOn401 } from "@/features/customer";

type Loaded<T> = { key: string; data?: T; status: number };

export function useAccountData<T>(key: string, load: () => Promise<{ data?: T; response: Response }>) {
  const [state, setState] = useState<Loaded<T> | null>(null);
  const [version, setVersion] = useState(0);
  const fetchData = useEffectEvent(load);
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let cancelled = false;
    fetchData()
      .then(expireOn401)
      .then(
        ({ data, response }) => {
          if (!cancelled) setState({ key, data, status: response.status });
        },
        () => {
          if (!cancelled) setState({ key, status: 0 });
        },
      );
    return () => {
      cancelled = true;
    };
  }, [key, version]);

  const current = state?.key === key ? state : null;
  return {
    data: current?.data,
    loading: !current,
    failed: current !== null && current.data === undefined,
    notFound: current?.status === 404,
    reload,
  };
}

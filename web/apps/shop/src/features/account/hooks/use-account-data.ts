"use client";

import { useCallback, useEffect, useEffectEvent, useState } from "react";
import { useCustomer, withActiveSession } from "@/features/customer";

type Loaded<T> = { key: string; owner: string; data?: T; status: number };

export function useAccountData<T>(key: string, load: () => Promise<{ data?: T; response: Response }>) {
  const owner = useCustomer().me?.id;
  const [state, setState] = useState<Loaded<T> | null>(null);
  const [version, setVersion] = useState(0);
  const fetchData = useEffectEvent(load);
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (!owner) return;
    let cancelled = false;
    void withActiveSession(fetchData, owner).then(
      ({ data, response }) => {
        if (!cancelled) setState({ key, owner, data, status: response.status });
      },
      () => {
        if (!cancelled) setState({ key, owner, status: 0 });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [key, owner, version]);

  const current = state?.key === key && state.owner === owner ? state : null;
  return {
    owner,
    data: current?.data,
    loading: !current,
    failed: current !== null && current.data === undefined,
    notFound: current?.status === 404,
    reload,
  };
}

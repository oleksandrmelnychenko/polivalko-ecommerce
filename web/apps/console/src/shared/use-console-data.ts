"use client";

import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useState } from "react";

export function useConsoleData<T>(key: string, load: () => Promise<{ data?: T; response: Response }>) {
  const router = useRouter();
  const [nonce, setNonce] = useState(0);
  const [state, setState] = useState<{ key: string | null; status: "error" | "ready"; data?: T }>({ key: null, status: "ready" });
  const current = `${key}#${nonce}`;
  const fetchData = useEffectEvent(load);

  useEffect(() => {
    let cancelled = false;
    fetchData()
      .then(({ data, response }) => {
        if (cancelled) return;
        if (response.status === 401) router.replace("/login");
        else setState({ key: current, status: data ? "ready" : "error", data });
      })
      .catch(() => !cancelled && setState({ key: current, status: "error" }));
    return () => {
      cancelled = true;
    };
  }, [current, router]);

  const status: "loading" | "error" | "ready" = state.key === current ? state.status : state.data ? "ready" : "loading";
  return {
    status,
    data: state.data,
    pending: state.key !== current && state.data !== undefined,
    reload: () => setNonce((n) => n + 1),
    setData: (data: T) => setState({ key: current, status: "ready", data }),
  };
}

"use client";

import { useEffect, useRef, useState } from "react";
import type { CharacterController } from "../lib/character-scene";

export function AssistantCharacter() {
  const stage = useRef<HTMLDivElement>(null);
  const controller = useRef<CharacterController | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void import("../lib/character-scene").then(({ mountCharacter }) => {
      if (cancelled || !stage.current) return;
      controller.current = mountCharacter(stage.current, () => setStatus("ready"), () => setStatus("error"));
    }).catch(() => {
      if (!cancelled) setStatus("error");
    });
    return () => {
      cancelled = true;
      controller.current?.dispose();
      controller.current = null;
    };
  }, []);

  return (
    <>
      <div className="assistant-character" data-ready={status === "ready" || undefined} role="img" aria-label="3D-персонаж Полі-Валька — зелена лійка">
        <img className="assistant-character__poster" src="/mascot/poli-valka-poster.png" width={253} height={450} alt="" />
        <div className="assistant-character__stage" ref={stage} aria-hidden="true" />
      </div>
      <div className="assistant-panel__footer">
        {status === "ready" ? (
          <button type="button" className="assistant-panel__motion" aria-pressed={paused} onClick={() => {
            controller.current?.setPaused(!paused);
            setPaused(!paused);
          }}>
            {paused ? "Відновити рух" : "Призупинити рух"}
          </button>
        ) : (
          <p role="status">{status === "loading" ? "Завантажую персонажа…" : "3D зараз недоступне. Полі-Валька залишається з вами."}</p>
        )}
      </div>
    </>
  );
}

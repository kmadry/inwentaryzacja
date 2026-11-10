"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type State = "connecting" | "live" | "off";

/**
 * Podgląd na żywo: nasłuchuje /api/live (SSE) i odświeża dane serwerowe,
 * gdy pojawi się nowy odczyt. Zwykłe odświeżanie co 15 s działa niezależnie jako zapas.
 */
export function LiveUpdates({ latestId }: { latestId: number | null }) {
  const router = useRouter();
  const [state, setState] = useState<State>("connecting");
  const known = useRef<number | null>(latestId);
  known.current = latestId;

  useEffect(() => {
    const es = new EventSource("/api/live");
    es.onopen = () => setState("live");
    es.onerror = () => setState(es.readyState === EventSource.CLOSED ? "off" : "connecting");
    es.addEventListener("reading", (ev) => {
      setState("live");
      try {
        const { id } = JSON.parse((ev as MessageEvent<string>).data) as { id: number };
        if (id !== (known.current ?? 0)) {
          known.current = id;
          router.refresh();
        }
      } catch {
        /* ignoruj uszkodzoną wiadomość */
      }
    });
    es.addEventListener("problem", () => setState("off"));
    return () => es.close();
  }, [router]);

  return (
    <span className={`live live--${state}`} title="Nowe odczyty pojawiają się automatycznie w ciągu ok. 2 s">
      <span className="live-dot" aria-hidden />
      {state === "live" ? "na żywo" : state === "connecting" ? "łączenie…" : "odświeżanie co 15 s"}
    </span>
  );
}

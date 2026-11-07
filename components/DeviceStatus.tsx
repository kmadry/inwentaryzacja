"use client";

import { useEffect, useState } from "react";
import { fmtDuration } from "@/lib/format";

type Props = {
  /** created_at ostatniego odczytu [ms] lub null, gdy brak odczytów */
  lastSeenMs: number | null;
  /** czas renderu po stronie serwera – pierwszy render bez rozjazdu hydracji */
  serverNowMs: number;
  offlineAfterMin: number;
};

/** Status liczony po stronie klienta – zmienia się na czerwony bez przeładowania i bez nowych danych. */
export function DeviceStatus({ lastSeenMs, serverNowMs, offlineAfterMin }: Props) {
  const [now, setNow] = useState(serverNowMs);
  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 5000);
    return () => window.clearInterval(id);
  }, []);

  if (lastSeenMs === null) {
    return (
      <p className="status status--off" role="status">
        <span className="dot" aria-hidden /> Waga jeszcze nic nie wysłała
      </p>
    );
  }
  const ageMin = Math.max(0, (now - lastSeenMs) / 60_000);
  const online = ageMin < offlineAfterMin;
  return (
    <p className={`status ${online ? "status--on" : "status--off"}`} role="status" aria-live="polite">
      <span className="dot" aria-hidden />
      {online
        ? `Online · ostatni odczyt ${ageMin < 1 ? "przed chwilą" : `${fmtDuration(ageMin)} temu`}`
        : `Brak sygnału od ${fmtDuration(ageMin)}`}
    </p>
  );
}

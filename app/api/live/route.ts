import { LIVE_MAX_S, LIVE_POLL_MS } from "@/lib/config";
import { getLatestRaw } from "@/lib/data";
import { AppError } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Server-Sent Events: serwer co LIVE_POLL_MS sprawdza najnowszy odczyt i wysyła jego id,
 * gdy się zmieni. Klucz Supabase zostaje na serwerze; przeglądarka dostaje tylko sygnał „odśwież”.
 * Po LIVE_MAX_S połączenie się kończy, a EventSource łączy się ponownie (limit czasu funkcji Vercel).
 */
export async function GET(req: Request) {
  const enc = new TextEncoder();
  const signal = req.signal;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (s: string) => {
        try {
          controller.enqueue(enc.encode(s));
        } catch {
          /* klient się rozłączył */
        }
      };
      send("retry: 1000\n\n");

      const deadline = Date.now() + LIVE_MAX_S * 1000;
      let lastId: number | null = null;
      let lastPing = Date.now();

      while (!signal.aborted && Date.now() < deadline) {
        try {
          const latest = (await getLatestRaw(1))[0];
          const id = latest?.id ?? 0;
          if (id !== lastId) {
            lastId = id;
            send(`event: reading\ndata: ${JSON.stringify({ id })}\n\n`);
          } else if (Date.now() - lastPing > 15_000) {
            send(": ping\n\n");
          }
          lastPing = Date.now();
        } catch (e) {
          const msg = e instanceof AppError ? `${e.title} ${e.fix}` : e instanceof Error ? e.message : String(e);
          send(`event: problem\ndata: ${JSON.stringify({ message: msg })}\n\n`);
        }
        await new Promise((r) => setTimeout(r, LIVE_POLL_MS));
      }
      try {
        controller.close();
      } catch {
        /* już zamknięty */
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

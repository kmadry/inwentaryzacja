import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Błąd z konkretnym opisem: co nie działa i jak to naprawić. */
export class AppError extends Error {
  constructor(
    public readonly title: string,
    public readonly fix: string,
    public readonly code?: string,
  ) {
    super(title);
    this.name = "AppError";
  }
}

let cached: SupabaseClient | null = null;

export function getStationId(): number {
  const v = process.env.STATION_ID;
  if (!v) return 1;
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) {
    throw new AppError(
      `Nieprawidłowa wartość STATION_ID: „${v}”.`,
      "Ustaw STATION_ID na dodatnią liczbę całkowitą (id wiersza w tabeli stations) albo usuń zmienną – domyślnie 1.",
    );
  }
  return n;
}

export function db(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  const missing = [!url && "SUPABASE_URL", !key && "SUPABASE_SECRET_KEY"].filter(Boolean);
  if (missing.length > 0 || !url || !key) {
    throw new AppError(
      `Brak zmiennej środowiskowej: ${missing.join(", ")}.`,
      "Dodaj ją w Vercel → Project → Settings → Environment Variables (lokalnie w pliku .env.local) i wdróż ponownie. " +
        "SUPABASE_URL to np. https://tmpdlgnnktdhxbadcqvf.supabase.co, SUPABASE_SECRET_KEY to klucz secret / service_role z Supabase → Project Settings → API Keys.",
    );
  }
  if (!/^https?:\/\//.test(url)) {
    throw new AppError(
      `SUPABASE_URL nie wygląda na adres URL: „${url}”.`,
      "Podaj pełny adres projektu, np. https://tmpdlgnnktdhxbadcqvf.supabase.co (bez /rest/v1).",
    );
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });
  return cached;
}

type PgErr = { code?: string; message: string; hint?: string | null; details?: string | null };

/** Zamienia błąd PostgREST/Supabase na AppError z podpowiedzią. */
export function sbError(what: string, e: PgErr): AppError {
  const code = e.code || undefined;
  const msg = [e.message, e.details, e.hint].filter(Boolean).join(" · ");
  let fix = "Sprawdź logi projektu w Supabase (Logs → API) i spróbuj ponownie.";
  if (code === "42P01" || code === "PGRST205") fix = "Brakuje tabeli/widoku w schemacie public – sprawdź, czy pracujesz na właściwym projekcie Supabase.";
  else if (code === "42703" || code === "PGRST204") fix = "Brakuje kolumny – uruchom migrację supabase/migrations/20261107000000_dashboard.sql (SQL Editor w Supabase).";
  else if (code === "42501") fix = "Brak uprawnień – SUPABASE_SECRET_KEY musi być kluczem secret / service_role, nie publishable/anon.";
  else if (code === "PGRST301" || code === "PGRST302" || /invalid api key|jwt/i.test(e.message))
    fix = "Klucz SUPABASE_SECRET_KEY jest nieprawidłowy lub unieważniony – skopiuj aktualny klucz secret z Supabase → Project Settings → API Keys.";
  else if (/fetch failed|ENOTFOUND|ECONNREFUSED|timed? ?out/i.test(e.message))
    fix = "Nie można połączyć się z Supabase – sprawdź SUPABASE_URL i czy projekt nie jest wstrzymany (Paused) w panelu Supabase.";
  return new AppError(`${what}: ${msg}`, fix, code);
}

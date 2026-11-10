# Waga magazynowa – dashboard

Next.js 15 (App Router, RSC) + Supabase + Vercel. Waga (ESP32 M5Atom + HX711) zapisuje surowe odczyty ADC
do `readings`; cała logika (gramy, butelki, zdarzenia, tarowanie, kalibracja) jest tutaj.

## Zmienne środowiskowe

| Zmienna | Wymagana | Opis |
|---|---|---|
| `SUPABASE_URL` | tak | Adres projektu, np. `https://tmpdlgnnktdhxbadcqvf.supabase.co` |
| `SUPABASE_SECRET_KEY` | tak | Klucz **secret** (`sb_secret_…`) lub `service_role`. Używany wyłącznie na serwerze. **Nie** dodawaj prefiksu `NEXT_PUBLIC_`. Zamiast niego może być `SUPABASE_SERVICE_ROLE_KEY` (ustawia go integracja Supabase ↔ Vercel). |
| `APP_PASSWORD` | nie | Hasło Basic Auth (login dowolny). Brak = strona otwarta. |
| `STATION_ID` | nie | Id stacji w `stations` (domyślnie `1`). |

Lokalnie: skopiuj `.env.example` do `.env.local`.

## Baza

Uruchom migrację `supabase/migrations/20261107000000_dashboard.sql` (SQL Editor w Supabase lub `supabase db push`):

- RLS na `stations` (bez polityk – zapis tylko kluczem secret),
- kolumna `stations.tared_at`,
- widok `readings_g` z `measured_at` i `event_at = coalesce(measured_at, created_at)` (`security_invoker`),
- indeks `readings (station_id, created_at)`.

Aplikacja działa także bez migracji (liczy gramy sama z `readings` + `stations`), ale nie zapisze daty tarowania.

Czas zdarzenia to zawsze `coalesce(measured_at, created_at)`; status urządzenia liczony jest z `created_at`
ostatniego odebranego odczytu.

## Uruchomienie

```bash
npm ci
```

```bash
npm run dev
```

```bash
npm run build && npm run check-bundle
```

`check-bundle` przeszukuje `.next/static` pod kątem kluczy Supabase (wzorce `sb_secret_`, JWT, `service_role`
oraz wartość `SUPABASE_SECRET_KEY`, jeśli jest w env).

## Deploy na Vercel

1. Importuj repozytorium w Vercel (framework: Next.js, ustawienia domyślne).
2. Dodaj zmienne z tabeli powyżej (Production + Preview).
3. Deploy.

## Jak to działa

- **Status**: online, gdy ostatni odczyt < 6 min temu. Liczony w przeglądarce co 5 s, więc zmienia się na
  czerwony bez przeładowania; dane odświeżane co 15 s (`router.refresh()`).
- **Masa**: ostatni odczyt wg czasu zdarzenia; ujemne → 0. Butelki = `round(g / 822)`, skrzynki po 20.
- **Wykres 24 h**: linia schodkowa (SVG), przerywana od ostatniego odczytu do „teraz”.
- **Zdarzenia**: `delta = g[i] − g[i−1]`, |delta| ≥ 158 g. Reszta od wielokrotności 822 g > 250 g → „niejednoznaczne”.
- **Tarowanie**: `offset_raw` = mediana `raw` 5 ostatnich odczytów, `tared_at = now()`.
- **Kalibracja**: `raw_per_g = (mediana − offset_raw) / X`.
  Waga wysyła odczyt tylko przy zmianie lub co 5 min, więc tuż po zmianie część z 5 odczytów jest „stara” –
  akcja odmawia, jeśli najnowszy odczyt odbiega od mediany o ≥ 3700 jednostek (odczekaj ~15 min).

Stałe są w `lib/config.ts`.

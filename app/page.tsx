import { AutoRefresh } from "@/components/AutoRefresh";
import { Chart } from "@/components/Chart";
import { Crates } from "@/components/Crates";
import { DeviceStatus } from "@/components/DeviceStatus";
import { LiveUpdates } from "@/components/LiveUpdates";
import { CalibrateForm, TareForm } from "@/components/Forms";
import { bottlesFor, detectEvents } from "@/lib/compute";
import { EMPTY_BOTTLE_G, EVENT_MIN_G, FULL_BOTTLE_G, MEDIAN_SAMPLES, OFFLINE_AFTER_MIN, REFRESH_MS } from "@/lib/config";
import { getDashboard, type Dashboard } from "@/lib/data";
import { fmtDateTime, fmtDec, fmtEventTime, fmtInt, fmtKg, fmtSignedInt, fmtSignedKg } from "@/lib/format";
import { AppError } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function ErrorPanel({ error }: { error: unknown }) {
  const e =
    error instanceof AppError
      ? error
      : new AppError(
          `Nieoczekiwany błąd: ${error instanceof Error ? error.message : String(error)}`,
          "Sprawdź logi funkcji w Vercel (Deployments → Functions) i zmienne środowiskowe.",
        );
  return (
    <section className="error" role="alert">
      <h2>Nie można wczytać danych{e.code ? ` (kod ${e.code})` : ""}</h2>
      <p>{e.title}</p>
      <p>
        <strong>Jak naprawić:</strong> {e.fix}
      </p>
      <p className="muted">Strona spróbuje ponownie za {REFRESH_MS / 1000} s.</p>
    </section>
  );
}

function Content({ data }: { data: Dashboard }) {
  const { station, current, points, fromMs, nowMs } = data;
  const grams = current ? Math.max(0, current.grams) : 0;
  const bottles = bottlesFor(grams);
  const events = detectEvents(points, fromMs);

  return (
    <>
      <section aria-labelledby="h-mass" className="block">
        <h2 id="h-mass" className="label">Aktualna masa</h2>
        {current ? (
          <>
            <p className="mass">
              <span className="mass-num">{fmtKg(grams)}</span>
              <span className="mass-unit">kg</span>
            </p>
            <p className="bottles">
              ≈ <strong>{fmtInt(bottles)}</strong> pełnych butelek
              <span className="muted"> · odczyt z {fmtEventTime(current.at, nowMs)}</span>
            </p>
            <Crates bottles={bottles} />
          </>
        ) : (
          <div className="empty">
            <p className="mass">
              <span className="mass-num">–</span>
            </p>
            <p>Brak odczytów w bazie. Gdy waga się połączy, pierwszy odczyt pojawi się tu w ciągu kilku sekund.</p>
          </div>
        )}
      </section>

      <section aria-labelledby="h-chart" className="block">
        <h2 id="h-chart" className="label">Ostatnie 24 h</h2>
        <Chart points={points} fromMs={fromMs} nowMs={nowMs} />
        {data.truncated && <p className="muted">Pokazano tylko część odczytów z okna (bardzo dużo danych).</p>}
      </section>

      <section aria-labelledby="h-events" className="block">
        <h2 id="h-events" className="label">Zdarzenia · 24 h</h2>
        {events.length === 0 ? (
          <p className="muted">Brak zmian ≥ {fmtInt(EVENT_MIN_G)} g w ciągu ostatnich 24 h.</p>
        ) : (
          <table className="events">
            <thead>
              <tr>
                <th scope="col">Godz.</th>
                <th scope="col" className="num">Zmiana</th>
                <th scope="col" className="num">Butelki</th>
                <th scope="col" className="num">Masa po</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className={e.deltaG > 0 ? "ev ev--in" : "ev ev--out"}>
                  <td>{fmtEventTime(e.at, nowMs)}</td>
                  <td className="num delta">{fmtSignedKg(e.deltaG)} kg</td>
                  <td className="num">
                    {e.ambiguous ? (
                      <span className="tag" title={`Zmiana nie jest wielokrotnością ${fmtInt(FULL_BOTTLE_G)} g (reszta ${fmtInt(e.remainderG)} g) – np. puste butelki (${fmtInt(EMPTY_BOTTLE_G)} g) odstawione na wagę.`}>
                        niejednoznaczne
                      </span>
                    ) : (
                      <>≈ {fmtSignedInt(e.bottles)}</>
                    )}
                  </td>
                  <td className="num">{fmtKg(Math.max(0, e.afterG))} kg</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section aria-labelledby="h-tare" className="block">
        <h2 id="h-tare" className="label">Tarowanie</h2>
        <p>
          Zdejmij wszystko z wagi, odczekaj kilka minut i naciśnij przycisk. Zero = mediana {MEDIAN_SAMPLES} ostatnich odczytów.
        </p>
        <TareForm />
        <p className="muted">
          Ostatnie tarowanie:{" "}
          {station.tared_at === undefined
            ? "nieznane – brak kolumny tared_at (uruchom migrację SQL)"
            : station.tared_at === null
              ? "nie zapisano"
              : fmtDateTime(Date.parse(station.tared_at))}
        </p>
      </section>

      <section aria-labelledby="h-calib" className="block">
        <h2 id="h-calib" className="label">Kalibracja</h2>
        <p>Po wytarowaniu połóż przedmiot o znanej masie (np. skrzynkę zważoną na innej wadze), odczekaj ok. 15 min i wpisz jego masę.</p>
        <CalibrateForm />
        <p className="muted">
          Stacja {station.id}
          {station.name ? ` „${station.name}”` : ""} · zero (offset_raw) {fmtInt(station.offset_raw)} · {fmtDec(station.raw_per_g)} jedn./g
        </p>
      </section>
    </>
  );
}

export default async function Page() {
  let data: Dashboard | null = null;
  let error: unknown = null;
  try {
    data = await getDashboard();
  } catch (e) {
    error = e;
  }

  return (
    <main className="page">
      <header className="head">
        <h1>Magazyn · waga</h1>
        {data && (
          <div className="head-status">
            <DeviceStatus lastSeenMs={data.lastSeenMs} serverNowMs={data.nowMs} offlineAfterMin={OFFLINE_AFTER_MIN} />
            <LiveUpdates latestId={data.latestId} />
          </div>
        )}
      </header>
      {data ? <Content data={data} /> : <ErrorPanel error={error} />}
      <AutoRefresh ms={REFRESH_MS} />
    </main>
  );
}

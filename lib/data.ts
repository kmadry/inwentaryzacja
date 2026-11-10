import "server-only";
import { MEDIAN_SAMPLES, WINDOW_HOURS } from "./config";
import { AppError, db, getStationId, sbError } from "./supabase";
import { toPoints, type Point, type RawReading } from "./compute";

export type Station = {
  id: number;
  name: string | null;
  offset_raw: number;
  raw_per_g: number;
  /** undefined = brak kolumny (migracja nie uruchomiona), null = nigdy nie tarowano */
  tared_at: string | null | undefined;
};

const COLS = "id, raw, created_at, measured_at";
const PAGE = 1000;
const MAX_PAGES = 20;

export async function getStation(): Promise<Station> {
  const id = getStationId();
  const { data, error } = await db().from("stations").select("*").eq("id", id).maybeSingle();
  if (error) throw sbError("Nie udało się odczytać tabeli stations", error);
  if (!data) {
    throw new AppError(
      `W tabeli stations nie ma stacji o id = ${id}.`,
      `Dodaj wiersz (insert into stations (id, name, offset_raw, raw_per_g) values (${id}, 'Magazyn', 0, 23.6297)) albo ustaw STATION_ID na istniejące id.`,
    );
  }
  const row = data as Record<string, unknown>;
  const offset = Number(row.offset_raw);
  const perG = Number(row.raw_per_g);
  if (!Number.isFinite(offset) || !Number.isFinite(perG) || perG === 0) {
    throw new AppError(
      `Stacja ${id} ma niepoprawną kalibrację (offset_raw = ${String(row.offset_raw)}, raw_per_g = ${String(row.raw_per_g)}).`,
      "Ustaw offset_raw i raw_per_g (≠ 0) w tabeli stations albo użyj formularza kalibracji poniżej po wytarowaniu wagi.",
    );
  }
  return {
    id,
    name: typeof row.name === "string" ? row.name : null,
    offset_raw: offset,
    raw_per_g: perG,
    tared_at: "tared_at" in row ? ((row.tared_at as string | null) ?? null) : undefined,
  };
}

function normalize(rows: unknown[]): RawReading[] {
  return (rows as Array<Record<string, unknown>>).map((r) => ({
    id: Number(r.id),
    raw: Number(r.raw),
    created_at: String(r.created_at),
    measured_at: r.measured_at == null ? null : String(r.measured_at),
  }));
}

/** Ostatnie odebrane odczyty (wg kolejności zapisu w bazie). */
export async function getLatestRaw(limit = MEDIAN_SAMPLES): Promise<RawReading[]> {
  const { data, error } = await db()
    .from("readings")
    .select(COLS)
    .eq("station_id", getStationId())
    .order("id", { ascending: false })
    .limit(limit);
  if (error) throw sbError("Nie udało się odczytać tabeli readings", error);
  return normalize(data ?? []);
}

export type Dashboard = {
  station: Station;
  nowMs: number;
  fromMs: number;
  /** Odczyty z okna + ostatni sprzed okna (jako punkt odniesienia), posortowane po czasie zdarzenia. */
  points: Point[];
  /** Ostatni punkt wg czasu zdarzenia = aktualna masa. */
  current: Point | null;
  /** Czas odebrania ostatniego odczytu przez bazę (created_at) – do statusu urządzenia. */
  lastSeenMs: number | null;
  /** id ostatniego odebranego odczytu – do podglądu na żywo */
  latestId: number | null;
  truncated: boolean;
};

export async function getDashboard(): Promise<Dashboard> {
  const station = await getStation();
  const nowMs = Date.now();
  const fromMs = nowMs - WINDOW_HOURS * 3600_000;
  const fromIso = new Date(fromMs).toISOString();
  const sid = station.id;

  // created_at >= measured_at, więc filtr po created_at obejmuje wszystkie odczyty z okna
  // (także buforowane, wysłane z opóźnieniem). Nadmiarowe odfiltrowujemy po czasie zdarzenia.
  const windowRows: RawReading[] = [];
  let truncated = false;
  for (let page = 0; ; page++) {
    const { data, error } = await db()
      .from("readings")
      .select(COLS)
      .eq("station_id", sid)
      .gte("created_at", fromIso)
      .order("id", { ascending: true })
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (error) throw sbError("Nie udało się odczytać tabeli readings", error);
    const rows = normalize(data ?? []);
    windowRows.push(...rows);
    if (rows.length < PAGE) break;
    if (page + 1 >= MAX_PAGES) {
      truncated = true;
      break;
    }
  }

  const [before, latest] = await Promise.all([
    db()
      .from("readings")
      .select(COLS)
      .eq("station_id", sid)
      .lt("created_at", fromIso)
      .order("id", { ascending: false })
      .limit(1),
    getLatestRaw(1),
  ]);
  if (before.error) throw sbError("Nie udało się odczytać tabeli readings", before.error);

  const all = toPoints([...normalize(before.data ?? []), ...windowRows], station);
  // punkt odniesienia: ostatni przed oknem, potem wszystko z okna
  const inWindow = all.filter((p) => p.at >= fromMs);
  const prior = all.filter((p) => p.at < fromMs).at(-1);
  const points = prior ? [prior, ...inWindow] : inWindow;

  const last = latest[0];
  return {
    station,
    nowMs,
    fromMs,
    points,
    current: points.at(-1) ?? null,
    lastSeenMs: last ? Date.parse(last.created_at) : null,
    latestId: last ? last.id : null,
    truncated,
  };
}


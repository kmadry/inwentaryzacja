import type { Point } from "@/lib/compute";
import { TIME_ZONE } from "@/lib/config";
import { fmtTime } from "@/lib/format";

type Props = { points: Point[]; fromMs: number; nowMs: number };

const W = 1000;
const H = 300;

const hourFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", hourCycle: "h23" });
const kgFmt = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 2 });

/** Ładny górny zakres osi Y w kg. */
function niceMax(kg: number): number {
  if (kg <= 1) return 1;
  const raw = kg * 1.1;
  const pow = 10 ** Math.floor(Math.log10(raw));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * pow >= raw) return m * pow;
  return 10 * pow;
}

/**
 * Wykres schodkowy: wartość trzyma się do następnego odczytu.
 * Linie rysowane w SVG (skalowane do szerokości), podpisy osi w HTML, żeby tekst się nie rozciągał.
 */
export function Chart({ points, fromMs, nowMs }: Props) {
  const span = nowMs - fromMs;
  const kg = (g: number) => Math.max(0, g) / 1000;
  const maxKg = niceMax(Math.max(0, ...points.map((p) => kg(p.grams))));
  const x = (t: number) => ((Math.min(Math.max(t, fromMs), nowMs) - fromMs) / span) * W;
  const y = (g: number) => H - (kg(g) / maxKg) * H;

  let d = "";
  const first = points[0];
  if (first) {
    d = `M${x(first.at).toFixed(1)},${y(first.grams).toFixed(1)}`;
    for (let i = 1; i < points.length; i++) {
      const p = points[i]!;
      d += `H${x(p.at).toFixed(1)}V${y(p.grams).toFixed(1)}`;
    }
  }
  const last = points.at(-1);

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * maxKg);
  const xTicks: number[] = [];
  for (let t = Math.ceil(fromMs / 3600_000) * 3600_000; t <= nowMs; t += 3600_000) {
    if (Number(hourFmt.format(t)) % 6 === 0) xTicks.push(t);
  }

  return (
    <figure className="chart">
      <div className="chart-plot">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Masa na wadze w ciągu ostatnich 24 godzin">
          {yTicks.map((v) => (
            <line key={v} className="grid" x1={0} x2={W} y1={H - (v / maxKg) * H} y2={H - (v / maxKg) * H} />
          ))}
          {xTicks.map((t) => (
            <line key={t} className="grid" x1={x(t)} x2={x(t)} y1={0} y2={H} />
          ))}
          {d && <path className="line" d={d} />}
          {last && last.at < nowMs && (
            <line className="line line--hold" x1={x(last.at)} x2={W} y1={y(last.grams)} y2={y(last.grams)} />
          )}
        </svg>
        {yTicks.slice(1).map((v) => (
          <span key={v} className="tick tick--y" style={{ top: `${100 - (v / maxKg) * 100}%` }}>
            {kgFmt.format(v)} kg
          </span>
        ))}
      </div>
      <div className="chart-x" aria-hidden>
        {xTicks.map((t) => (
          <span key={t} className="tick tick--x" style={{ left: `${(x(t) / W) * 100}%` }}>
            {fmtTime(t)}
          </span>
        ))}
      </div>
      {points.length === 0 && <figcaption className="muted">Brak odczytów z ostatnich 24 h.</figcaption>}
    </figure>
  );
}

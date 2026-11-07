import { BOTTLES_PER_CRATE, MAX_CRATES_SHOWN } from "@/lib/config";
import { fmtInt } from "@/lib/format";

/** Skrzynki po 20 miejsc (4 × 5); wypełnione kółko = pełna butelka. */
export function Crates({ bottles }: { bottles: number }) {
  const n = Math.max(0, bottles);
  const crates = Math.max(1, Math.ceil(n / BOTTLES_PER_CRATE));
  const shown = Math.min(crates, MAX_CRATES_SHOWN);
  const hiddenCrates = crates - shown;

  return (
    <div className="crates" aria-label={`${fmtInt(n)} butelek, ${fmtInt(Math.ceil(n / BOTTLES_PER_CRATE))} skrzynek`}>
      {Array.from({ length: shown }, (_, c) => {
        const filled = Math.min(BOTTLES_PER_CRATE, Math.max(0, n - c * BOTTLES_PER_CRATE));
        return (
          <div className="crate" key={c} aria-hidden>
            {Array.from({ length: BOTTLES_PER_CRATE }, (_, b) => (
              <span key={b} className={b < filled ? "slot slot--full" : "slot"} />
            ))}
          </div>
        );
      })}
      {hiddenCrates > 0 && <span className="crates-more">+{fmtInt(hiddenCrates)} skrz.</span>}
    </div>
  );
}

/** Wszystkie stałe biznesowe w jednym miejscu. */

/** Masa pełnej butelki 0,5 l [g]. */
export const FULL_BOTTLE_G = 822;
/** Masa pustej butelki 0,5 l [g]. */
export const EMPTY_BOTTLE_G = 317;
/** Liczba butelek w skrzynce. */
export const BOTTLES_PER_CRATE = 20;
/** Minimalna zmiana masy uznawana za zdarzenie [g] (~pół pustej butelki). */
export const EVENT_MIN_G = 158;
/** Po ilu minutach bez odczytu urządzenie uznajemy za offline. */
export const OFFLINE_AFTER_MIN = 6;
/** Interwał auto-odświeżania strony [ms] (zapas, gdy podgląd na żywo nie działa). */
export const REFRESH_MS = 15000;
/** Co ile serwer sprawdza nowe odczyty dla podglądu na żywo [ms]. */
export const LIVE_POLL_MS = 2000;
/** Maksymalna długość jednego połączenia na żywo [s] – potem przeglądarka łączy się ponownie. */
export const LIVE_MAX_S = 55;

/** Reszta z dzielenia przez FULL_BOTTLE_G, powyżej której zdarzenie jest „niejednoznaczne” [g]. */
export const AMBIGUOUS_REMAINDER_G = 250;
/** Maksymalna liczba rysowanych skrzynek. */
export const MAX_CRATES_SHOWN = 6;
/** Liczba ostatnich odczytów, z których liczona jest mediana (tarowanie, kalibracja). */
export const MEDIAN_SAMPLES = 5;
/** Próg zmiany odczytu w urządzeniu [jednostki ADC] – używany do oceny stabilności. */
export const DEVICE_DELTA_RAW = 3700;
/** Okno wykresu i listy zdarzeń [h]. */
export const WINDOW_HOURS = 24;

/** Prezentacja. */
export const TIME_ZONE = "Europe/Warsaw";
export const LOCALE = "pl-PL";

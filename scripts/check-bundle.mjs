// Sprawdza, czy w kodzie klienta (.next/static) nie ma kluczy Supabase.
// Użycie: npm run build && npm run check-bundle  (z SUPABASE_SECRET_KEY w env – sprawdzi też jego wartość)
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = ".next/static";
const patterns = [
  /sb_secret_[A-Za-z0-9_-]{10,}/,
  /sb_publishable_[A-Za-z0-9_-]{10,}/,
  /eyJhbGciOi[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+/, // JWT (anon / service_role)
  /service_role/,
  /SUPABASE_SECRET_KEY/,
];
const secret = process.env.SUPABASE_SECRET_KEY;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else yield p;
  }
}

let bad = 0;
let files = 0;
for (const file of walk(root)) {
  files++;
  const text = readFileSync(file, "utf8");
  for (const re of patterns) {
    if (re.test(text)) {
      console.error(`✗ ${file}: pasuje do ${re}`);
      bad++;
    }
  }
  if (secret && text.includes(secret)) {
    console.error(`✗ ${file}: zawiera wartość SUPABASE_SECRET_KEY`);
    bad++;
  }
}
if (bad) {
  console.error(`Znaleziono ${bad} problem(y) w ${files} plikach.`);
  process.exit(1);
}
console.log(`✓ ${files} plików w ${root} – brak kluczy Supabase.`);

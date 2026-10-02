/**
 * Palet tutarlılık denetimi.
 *
 * `packages/core/src/theme.ts` mobilin paletidir, `app/globals.css` webin.
 * İkisi elle tutulduğu için zamanla ayrışabilir — bu betik her jetonu
 * karşılaştırır ve fark bulursa çıkış kodu 1 ile döner.
 *
 * Çalıştır: npm run check:theme
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** `:root { ... }` veya `.dark { ... }` bloğundaki değişkenleri okur. */
function cssTokens(css, selector) {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`CSS bloğu bulunamadı: ${selector}`);
  const end = css.indexOf("\n}", start);
  const block = css.slice(start, end);

  const tokens = {};
  for (const line of block.split("\n")) {
    const match = line.match(/^\s*(--[a-z0-9-]+)\s*:\s*([^;]+);/i);
    if (match) tokens[match[1]] = match[2].trim().toLowerCase();
  }
  return tokens;
}

/** theme.ts'ten `export const <ad>: ThemePalette = { ... }` bloğunu okur. */
function tsPalette(source, name) {
  const start = source.indexOf(`export const ${name}: ThemePalette = {`);
  if (start === -1) throw new Error(`Palet bulunamadı: ${name}`);
  const end = source.indexOf("\n};", start);
  const block = source.slice(start, end);

  const tokens = {};
  for (const line of block.split("\n")) {
    const match = line.match(/^\s*([a-zA-Z0-9]+)\s*:\s*"([^"]+)"/);
    if (match) tokens[match[1]] = match[2].trim().toLowerCase();
  }
  return tokens;
}

/** CSS_VARIABLE_MAP'i theme.ts'ten okur — eşleme de tek yerde kalsın. */
function variableMap(source) {
  const start = source.indexOf("export const CSS_VARIABLE_MAP");
  const end = source.indexOf("\n};", start);
  const block = source.slice(start, end);

  const map = {};
  for (const line of block.split("\n")) {
    const match = line.match(/^\s*([a-zA-Z0-9]+)\s*:\s*"(--[a-z0-9-]+)"/i);
    if (match) map[match[1]] = match[2];
  }
  return map;
}

const css = readFileSync(join(root, "app", "globals.css"), "utf8");
const theme = readFileSync(
  join(root, "packages", "core", "src", "theme.ts"),
  "utf8"
);

const map = variableMap(theme);
const problems = [];
let checked = 0;

for (const [paletteName, selector] of [
  ["lightPalette", ":root"],
  ["darkPalette", ".dark"],
]) {
  const ts = tsPalette(theme, paletteName);
  const web = cssTokens(css, selector);

  for (const [token, cssVar] of Object.entries(map)) {
    const tsValue = ts[token];
    const cssValue = web[cssVar];
    checked += 1;

    if (tsValue === undefined) {
      problems.push(`${paletteName}.${token} tanımsız`);
    } else if (cssValue === undefined) {
      problems.push(`${selector} içinde ${cssVar} yok`);
    } else if (tsValue !== cssValue) {
      problems.push(
        `${selector} ${cssVar} = ${cssValue}  ≠  ${paletteName}.${token} = ${tsValue}`
      );
    }
  }
}

if (problems.length > 0) {
  console.error(`✗ Palet ayrışmış (${problems.length} fark):\n`);
  for (const p of problems) console.error("  " + p);
  console.error(
    "\nDüzelt: app/globals.css ve packages/core/src/theme.ts aynı değeri taşımalı."
  );
  process.exit(1);
}

console.log(
  `✓ Palet tutarlı — ${checked} jeton, açık ve koyu mod, web ve mobil aynı değerleri kullanıyor.`
);

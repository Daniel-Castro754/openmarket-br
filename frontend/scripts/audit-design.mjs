import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const cssRoots = ["app", "components"].map((entry) => path.join(root, entry));
const tokenFile = path.normalize(path.join(root, "app", "design-system.css"));
const printFile = path.normalize(path.join(root, "app", "print.css"));
const legacyLayers = [
  "theme-bridge.css",
  "design-governance.css",
  "visual-overrides.css",
  "visual-qa.css",
  "final-polish.css",
  "sidebar-layout-fix.css",
  "page-proportions.css",
].map((name) => path.normalize(path.join(root, "app", name)));

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.isFile() && entry.name.endsWith(".css") ? [full] : [];
  });
}

function stripComments(value) {
  return value.replace(/\/\*[\s\S]*?\*\//g, "");
}

function toPx(number, unit) {
  const value = Number(number);
  return unit.toLowerCase() === "px" ? value : value * 16;
}

const files = cssRoots.flatMap(walk);
const uniqueFontSizes = new Set();
let under12 = 0;
let hexOutsideTokens = 0;
let importantOutsidePrint = 0;

for (const file of files) {
  const source = stripComments(fs.readFileSync(file, "utf8"));

  for (const match of source.matchAll(/font-size\s*:\s*([^;}{]+);/gi)) {
    for (const size of match[1].matchAll(/(-?\d*\.?\d+)\s*(px|rem|em)\b/gi)) {
      const px = toPx(size[1], size[2]);
      uniqueFontSizes.add(Number(px.toFixed(3)));
      if (px < 12) under12 += 1;
    }
  }

  if (path.normalize(file) !== tokenFile) {
    hexOutsideTokens += (source.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).length;
  }

  if (path.normalize(file) !== printFile) {
    importantOutsidePrint += (source.match(/!important\b/g) ?? []).length;
  }
}

const presentLegacyLayers = legacyLayers
  .filter((file) => fs.existsSync(file))
  .map((file) => path.relative(root, file));

const result = {
  cssFiles: files.length,
  fontSizesBelow12: under12,
  distinctFontSizes: uniqueFontSizes.size,
  hexColorsOutsideTokenFile: hexOutsideTokens,
  importantOutsidePrint,
  legacyCorrectionLayers: presentLegacyLayers.length,
};

console.log(JSON.stringify(result, null, 2));

if (process.argv.includes("--strict")) {
  const failures = [];
  if (under12 !== 0) failures.push(`font-size abaixo de 12 px: ${under12}`);
  if (uniqueFontSizes.size > 8) failures.push(`tamanhos de fonte distintos: ${uniqueFontSizes.size}`);
  if (hexOutsideTokens !== 0) failures.push(`cores hex fora de design-system.css: ${hexOutsideTokens}`);
  if (importantOutsidePrint !== 0) failures.push(`!important fora de print.css: ${importantOutsidePrint}`);
  if (presentLegacyLayers.length !== 0) failures.push(`camadas legadas restantes: ${presentLegacyLayers.length}`);

  if (failures.length) {
    console.error("\nMetas finais da Fase 1 ainda não atingidas:");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }
}

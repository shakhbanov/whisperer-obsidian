/**
 * Согласует версию плагина в трёх местах: `package.json`, `manifest.json` и
 * `versions.json`.
 *
 * Версия обязана совпадать во всех трёх. `manifest.json` читает Obsidian,
 * `versions.json` — его каталог плагинов, чтобы понять, с какой версией
 * редактора совместим релиз. Разойдись они, обновление либо не предложится
 * никому, либо предложится тем, у кого редактор старее нужного.
 *
 * Запускается автоматически из `npm version` (см. скрипт `version` в
 * `package.json`), поэтому руками номер править не нужно.
 */
import { readFileSync, writeFileSync } from "node:fs";
import process from "node:process";

const target = process.env.npm_package_version;
if (!target) {
  console.error("version-bump: запускать через `npm version`, а не напрямую");
  process.exit(1);
}

const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
manifest.version = target;
writeFileSync("manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);

const versions = JSON.parse(readFileSync("versions.json", "utf8"));
versions[target] = manifest.minAppVersion;
writeFileSync("versions.json", `${JSON.stringify(versions, null, 2)}\n`);

console.log(`version-bump: ${target} (Obsidian ≥ ${manifest.minAppVersion})`);

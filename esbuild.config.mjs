/**
 * Сборка плагина: один файл `main.js` рядом с манифестом.
 *
 * Obsidian грузит плагин как CommonJS-модуль из своего каталога и НЕ разрешает
 * зависимости сам — поэтому всё, кроме API самого редактора и встроенных модулей
 * Electron, обязано быть вшито в бандл. Отсюда `external` ровно на то, что даёт
 * хозяин процесса, и `bundle: true` на всё остальное.
 */
import esbuild from "esbuild";
import process from "node:process";
import { builtinModules } from "node:module";

const production = process.argv[2] === "production";

const context = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  // Всё это предоставляет сам Obsidian/Electron. Вшив их, мы получили бы вторую
  // копию редактора внутри плагина — и она не работала бы.
  external: [
    "obsidian",
    "electron",
    "@codemirror/autocomplete",
    "@codemirror/collab",
    "@codemirror/commands",
    "@codemirror/language",
    "@codemirror/lint",
    "@codemirror/search",
    "@codemirror/state",
    "@codemirror/view",
    "@lezer/common",
    "@lezer/highlight",
    "@lezer/lr",
    // Встроенные модули Node перечисляет он сам — отдельный пакет для
    // этого держать незачем, и проверка каталога Obsidian на него ругается.
    ...builtinModules,
    ...builtinModules.map((name) => `node:${name}`),
  ],
  format: "cjs",
  target: "es2022",
  logLevel: "info",
  // Карта исходников только в разработке: в релизном файле она удвоила бы вес
  // плагина, который пользователь скачивает.
  sourcemap: production ? false : "inline",
  treeShaking: true,
  outfile: "main.js",
  minify: production,
});

if (production) {
  await context.rebuild();
  process.exit(0);
}

await context.watch();

/**
 * Фирменный знак Whisperer для ленты и команд Obsidian.
 *
 * Знак платформы — сетка 3×3 из плиток со скруглёнными углами (в полном виде на
 * них буквы W H I S P E R E R). В ленте иконка рисуется размером примерно в
 * восемнадцать точек: девять букв там не читались бы, а вот силуэт сетки —
 * читается и остаётся узнаваемым.
 *
 * Цвет НЕ фирменный, а `currentColor`: иконку в ленте красит тема Obsidian, в
 * том числе при наведении и в активном состоянии. Жёлтый литерал выглядел бы
 * инородно в тёмной теме и не менялся бы вместе с соседями.
 *
 * Геометрия повторяет `frontend/src/lib/brand/mark.ts`: плитка 30, зазор 5,
 * скругление 4.8 — итого ровно 100 единиц, то есть система координат, которую
 * ждёт `addIcon`.
 */
import { addIcon } from "obsidian";

export const BRAND_ICON = "whisperer-mark";

const TILE = 30;
const GAP = 5;
const RADIUS = 4.8;
const POSITIONS = [0, TILE + GAP, 2 * (TILE + GAP)];

export function registerBrandIcon(): void {
  const tiles = POSITIONS.flatMap((y) =>
    POSITIONS.map(
      (x) =>
        `<rect x="${x}" y="${y}" width="${TILE}" height="${TILE}" rx="${RADIUS}" fill="currentColor"/>`,
    ),
  ).join("");
  addIcon(BRAND_ICON, tiles);
}

/**
 * Синхронизация хранилища с базой знаний.
 *
 * Два режима, и разница между ними — в том, ЧЕМУ доверять как состоянию
 * сервера:
 *
 * * **обычный** сверяется с локальным указателем (что это устройство уже
 *   отправляло). Дёшев: читает только те заметки, которые изменились;
 * * **полный** спрашивает у сервера перечень путей с отпечатками и сверяется с
 *   ним. Нужен после переустановки плагина, при работе с двух машин и всякий
 *   раз, когда локальный указатель мог разойтись с действительностью.
 *
 * Заметка опознаётся ПУТЁМ внутри хранилища, а её содержимое — отпечатком
 * sha256. Отпечаток считается от тех же байтов, что уезжают на сервер (UTF-8),
 * поэтому «изменилось ли» решается одинаково на обеих сторонах, и неизменная
 * заметка не отправляется повторно.
 *
 * Указатель хранит ещё время правки и размер файла: если они совпали с
 * запомненными, содержимое не перечитывается вовсе. Без этого каждая сверка
 * хранилища на пять тысяч заметок означала бы пять тысяч чтений с диска.
 */
import type { App, TFile } from "obsidian";

import { ApiError, type VaultLimits, type WhispererApi } from "./api";

export interface IndexEntry {
  hash: string;
  mtime: number;
  size: number;
}

export type SyncIndex = Record<string, IndexEntry>;

export interface SyncRequest {
  /** Полная сверка с сервером вместо доверия локальному указателю. */
  full: boolean;
  /** Пути, изменившиеся с прошлой синхронизации. Пусто при полной сверке. */
  dirty: Set<string>;
  /** Пути, удалённые в хранилище с прошлой синхронизации. */
  deleted: Set<string>;
}

export interface SyncOutcome {
  sent: number;
  removed: number;
  /** Заметки, не влезшие в предел размера. Не ошибка синхронизации, но человек
   *  обязан узнать: иначе он считал бы, что ассистент их видит. */
  skippedTooLarge: number;
  usedBytes: number;
  limitBytes: number;
}

interface Batch {
  notes: { path: string; content: string; hash: string; file: TFile }[];
  removed: string[];
  bytes: number;
}

export class SyncEngine {
  constructor(
    private readonly app: App,
    private readonly api: WhispererApi,
    private readonly index: SyncIndex,
    private readonly persist: () => Promise<void>,
    private readonly onProgress: (done: number, total: number) => void,
  ) {}

  /** Файлы хранилища, которые вообще подлежат отправке. */
  eligibleFiles(limits: VaultLimits, excluded: string[]): TFile[] {
    const suffixes = new Set(limits.allowedSuffixes.map((suffix) => suffix.toLowerCase()));
    return this.app.vault.getFiles().filter((file) => {
      if (!suffixes.has(`.${file.extension.toLowerCase()}`)) return false;
      return !isExcluded(file.path, excluded);
    });
  }

  async run(request: SyncRequest, excluded: string[]): Promise<SyncOutcome> {
    const status = await this.api.status();
    const limits = status.limits;
    const files = this.eligibleFiles(limits, excluded);
    const byPath = new Map(files.map((file) => [file.path, file]));

    const candidates: TFile[] = [];
    const removals = new Set<string>();

    if (request.full) {
      const remote = await this.fetchManifest();
      for (const file of files) {
        const known = await this.hashOf(file);
        if (remote.get(file.path) !== known) candidates.push(file);
      }
      for (const path of remote.keys()) {
        // Сервер знает заметку, которой в хранилище больше нет: её либо стёрли
        // на другом устройстве, либо она попала под исключение папок. И то и
        // другое означает одно — из базы знаний её надо убрать.
        if (!byPath.has(path)) removals.add(path);
      }
    } else {
      for (const path of request.dirty) {
        const file = byPath.get(path);
        if (file === undefined) continue;
        const known = await this.hashOf(file);
        if (this.index[path]?.hash !== known) candidates.push(file);
      }
      for (const path of request.deleted) {
        // Отправляем только то, что этим устройством отправлялось: удаление
        // никогда не существовавшей заметки сервер примет как выполненное, но
        // запрос на него всё равно был бы напрасной работой.
        if (this.index[path] !== undefined) removals.add(path);
      }
    }

    const outcome: SyncOutcome = {
      sent: 0,
      removed: 0,
      skippedTooLarge: 0,
      usedBytes: status.usedBytes,
      limitBytes: status.limitBytes,
    };

    const total = candidates.length + removals.size;
    if (total === 0) return outcome;

    let done = 0;
    const pendingRemovals = [...removals];

    for await (const batch of this.batches(candidates, pendingRemovals, limits, outcome)) {
      const result = await this.api.push(
        batch.notes.map((note) => ({ path: note.path, content: note.content })),
        batch.removed,
      );

      // Указатель обновляется ПОСЛЕ ответа сервера и сразу сохраняется: оборвись
      // синхронизация на середине, повторный запуск не начинал бы с нуля.
      // Отдельно — `unchanged`: сервер уже держит эту заметку, и запоминать её
      // отпечаток так же обязательно, иначе она уезжала бы каждый раз.
      const settled = new Set([...result.accepted, ...result.unchanged]);
      for (const note of batch.notes) {
        if (!settled.has(note.path)) continue;
        this.index[note.path] = {
          hash: note.hash,
          mtime: note.file.stat.mtime,
          size: note.file.stat.size,
        };
      }
      for (const path of result.removed) delete this.index[path];
      await this.persist();

      outcome.sent += result.accepted.length;
      outcome.removed += result.removed.length;
      outcome.usedBytes = result.usedBytes;
      outcome.limitBytes = result.limitBytes;

      done += batch.notes.length + batch.removed.length;
      this.onProgress(Math.min(done, total), total);
    }

    return outcome;
  }

  /** Пачки, нарезанные ПО ПРЕДЕЛАМ СЕРВЕРА — и по числу заметок, и по объёму.
   *
   *  Генератор, а не готовый список: собери мы все пачки заранее, содержимое
   *  всего хранилища оказалось бы в памяти одновременно. Здесь в памяти живёт
   *  ровно одна пачка.
   */
  private async *batches(
    files: TFile[],
    removals: string[],
    limits: VaultLimits,
    outcome: SyncOutcome,
  ): AsyncGenerator<Batch> {
    let batch: Batch = { notes: [], removed: [], bytes: 0 };
    const queue = [...removals];

    const takeRemovals = (current: Batch): void => {
      const room = limits.maxNotesPerPush - current.notes.length;
      if (room > 0 && queue.length > 0) current.removed = queue.splice(0, room);
    };

    for (const file of files) {
      const content = await this.app.vault.cachedRead(file);
      const bytes = byteLength(content);
      if (bytes > limits.maxNoteBytes || bytes === 0) {
        // Пустая заметка сервером отвергается (`empty_note`), слишком большая —
        // тоже. Тихо пропустить их нельзя: человек считал бы, что ассистент их
        // видит. Пустые в счётчик не идут — это рабочее состояние черновика.
        if (bytes > 0) outcome.skippedTooLarge += 1;
        continue;
      }

      const wouldOverflow =
        batch.notes.length >= limits.maxNotesPerPush ||
        batch.bytes + bytes > limits.maxPushBytes;
      if (wouldOverflow && batch.notes.length > 0) {
        takeRemovals(batch);
        yield batch;
        batch = { notes: [], removed: [], bytes: 0 };
      }

      batch.notes.push({ path: file.path, content, hash: await sha256(content), file });
      batch.bytes += bytes;
    }

    if (batch.notes.length > 0) {
      takeRemovals(batch);
      yield batch;
    }

    // Остаток удалений: их может быть больше, чем нашлось пачек с заметками, —
    // например, когда человек стёр папку и ничего не правил.
    while (queue.length > 0) {
      yield { notes: [], removed: queue.splice(0, limits.maxNotesPerPush), bytes: 0 };
    }
  }

  /** Отпечаток заметки. Файл читается, только если он изменился с прошлого раза. */
  private async hashOf(file: TFile): Promise<string> {
    const known = this.index[file.path];
    if (known && known.mtime === file.stat.mtime && known.size === file.stat.size) {
      return known.hash;
    }
    return sha256(await this.app.vault.cachedRead(file));
  }

  private async fetchManifest(): Promise<Map<string, string>> {
    const remote = new Map<string, string>();
    let offset: number | null = 0;
    while (offset !== null) {
      const page: { notes: { path: string; sha256: string }[]; nextOffset: number | null } =
        await this.api.manifest(offset);
      for (const note of page.notes) remote.set(note.path, note.sha256);
      offset = page.nextOffset;
    }
    return remote;
  }
}

/** Лежит ли путь внутри исключённой папки. Сравнение по сегментам, а не по
 *  префиксу строки: иначе папка `Личное` заодно исключила бы `Личное-архив`. */
export function isExcluded(path: string, excluded: string[]): boolean {
  return excluded.some((folder) => path === folder || path.startsWith(`${folder}/`));
}

function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

/** sha256 содержимого — тот же, что считает сервер по принятым байтам. */
export async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** Отказ, после которого продолжать бессмысленно, — в отличие от временного. */
export function isFatal(error: unknown): boolean {
  return error instanceof ApiError && !error.isTransient;
}

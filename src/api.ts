/**
 * Обращения к Whisperer. Единственное место, знающее его HTTP-контракт.
 *
 * Запросы идут через `requestUrl` самого Obsidian, а не через `fetch`: обычный
 * `fetch` из плагина упирается в политику источника окна редактора, и на
 * мобильной сборке запрос не уходит вовсе. `requestUrl` выполняет его на
 * стороне приложения.
 *
 * Отказ поставщика разбирается ПО КОДУ ответа, а не по тексту: текст
 * локализован и меняется, а код — контракт. Три кода означают три разных
 * действия человека, и путать их нельзя: 401 — «переподключите хранилище»,
 * 403 — «нужна подписка», 413 — «освободите место».
 */
import { requestUrl } from "obsidian";

/** Пределы приёма. Приходят С СЕРВЕРА: разойдись копии, плагин собирал бы
 *  пачки, которые сервер отвергает, и человек видел бы отказ вместо работы. */
export interface VaultLimits {
  maxNoteBytes: number;
  maxNotesPerPush: number;
  maxPushBytes: number;
  allowedSuffixes: string[];
}

export interface VaultStatus {
  displayName: string;
  notes: number;
  usedBytes: number;
  limitBytes: number;
  limits: VaultLimits;
}

export interface ManifestPage {
  notes: { path: string; sha256: string }[];
  nextOffset: number | null;
}

export interface PushResult {
  accepted: string[];
  unchanged: string[];
  removed: string[];
  usedBytes: number;
  limitBytes: number;
}

/** Отказ сервера. `status === 0` — до сервера не дошли вовсе. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(`${status} ${code}`);
    this.name = "ApiError";
  }

  /** Токен больше не действует: повтор не поможет, нужен человек. */
  get isAuthFailure(): boolean {
    return this.status === 401;
  }

  /** Временная неудача: сеть, лимит частоты, недоступность поставщика.
   *  Ровно эти случаи имеет смысл повторить позже, остальные — нет. */
  get isTransient(): boolean {
    return this.status === 0 || this.status === 429 || this.status >= 500;
  }
}

const DEFAULT_LIMITS: VaultLimits = {
  maxNoteBytes: 1024 * 1024,
  maxNotesPerPush: 50,
  maxPushBytes: 8 * 1024 * 1024,
  allowedSuffixes: [".md", ".markdown", ".txt", ".canvas"],
};

export class WhispererApi {
  constructor(
    private readonly serverUrl: string,
    private readonly token: string,
  ) {}

  get configured(): boolean {
    return this.token.trim().length > 0 && this.serverUrl.trim().length > 0;
  }

  async status(): Promise<VaultStatus> {
    const body = await this.request<{
      source: { display_name: string };
      notes: number;
      used_bytes: number;
      limit_bytes: number;
      limits: {
        max_note_bytes: number;
        max_notes_per_push: number;
        max_push_bytes: number;
        allowed_suffixes: string[];
      };
    }>("GET", "/status");

    return {
      displayName: body.source?.display_name ?? "Obsidian",
      notes: body.notes ?? 0,
      usedBytes: body.used_bytes ?? 0,
      limitBytes: body.limit_bytes ?? 0,
      limits: {
        // Каждое значение с запасным: сервер новее плагина может не прислать
        // поле, и синхронизация не должна ломаться из-за отсутствующего числа.
        maxNoteBytes: body.limits?.max_note_bytes ?? DEFAULT_LIMITS.maxNoteBytes,
        maxNotesPerPush: body.limits?.max_notes_per_push ?? DEFAULT_LIMITS.maxNotesPerPush,
        maxPushBytes: body.limits?.max_push_bytes ?? DEFAULT_LIMITS.maxPushBytes,
        allowedSuffixes: body.limits?.allowed_suffixes ?? DEFAULT_LIMITS.allowedSuffixes,
      },
    };
  }

  async manifest(offset: number): Promise<ManifestPage> {
    const body = await this.request<{
      notes: { path: string; sha256: string }[];
      next_offset: number | null;
    }>("GET", `/manifest?offset=${offset}`);
    return { notes: body.notes ?? [], nextOffset: body.next_offset ?? null };
  }

  async push(
    notes: { path: string; content: string }[],
    removed: string[],
  ): Promise<PushResult> {
    const body = await this.request<{
      accepted: string[];
      unchanged: string[];
      removed: string[];
      used_bytes: number;
      limit_bytes: number;
    }>("POST", "/notes", { notes, removed });
    return {
      accepted: body.accepted ?? [],
      unchanged: body.unchanged ?? [],
      removed: body.removed ?? [],
      usedBytes: body.used_bytes ?? 0,
      limitBytes: body.limit_bytes ?? 0,
    };
  }

  private async request<T>(method: string, path: string, payload?: unknown): Promise<T> {
    const base = this.serverUrl.trim().replace(/\/+$/, "");
    let response;
    try {
      response = await requestUrl({
        url: `${base}/v1/knowledge/vault${path}`,
        method,
        headers: {
          Authorization: `Bearer ${this.token.trim()}`,
          ...(payload === undefined ? {} : { "Content-Type": "application/json" }),
        },
        body: payload === undefined ? undefined : JSON.stringify(payload),
        // Разбираем код сами: `requestUrl` по умолчанию бросает на любом не-2xx,
        // и различить «нет подписки» и «нет связи» стало бы нечем.
        throw: false,
      });
    } catch (error) {
      // Сюда попадает только сетевой отказ: DNS, обрыв, нет интернета.
      throw new ApiError(0, error instanceof Error ? error.message : "network_error");
    }

    if (response.status >= 400) {
      throw new ApiError(response.status, detailOf(response.text));
    }
    return response.json as T;
  }
}

/** Машинный код причины из тела ответа. Текст наружу не показываем: в нём
 *  может быть чужая подробность, а человеку нужна понятная фраза плагина. */
function detailOf(text: string): string {
  try {
    const parsed = JSON.parse(text) as { detail?: unknown };
    return typeof parsed.detail === "string" ? parsed.detail : "error";
  } catch {
    return "error";
  }
}

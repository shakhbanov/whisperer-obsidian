/**
 * Whisperer Sync — хранилище Obsidian в базе знаний Whisperer.
 *
 * Поток данных здесь ОДИН и только один: от хранилища к платформе. Плагин
 * ничего не скачивает и ничего не переписывает в заметках — ни строчки. Это не
 * упрощение первой версии, а свойство: программа, которая правит чужие заметки,
 * обязана иметь для этого причину, а у синхронизации знаний её нет.
 *
 * Что уезжает: путь заметки внутри хранилища и её текст. Что НЕ уезжает: файлы
 * вне белого списка расширений, содержимое исключённых папок и всё, что лежит
 * в служебном каталоге `.obsidian`.
 */
import { Notice, Plugin, TAbstractFile, TFile } from "obsidian";

import { ApiError, WhispererApi } from "./api";
import { BRAND_ICON, registerBrandIcon } from "./icon";
import { t } from "./i18n";
import { DEFAULT_SETTINGS, WhispererSettingTab, type WhispererSettings } from "./settings";
import { SyncEngine, isExcluded, isFatal, type SyncIndex } from "./sync";

interface PluginData {
  settings: WhispererSettings;
  /** Что это устройство уже отправляло: путь → отпечаток, время и размер. */
  index: SyncIndex;
  lastSyncAt: number | null;
}

export default class WhispererPlugin extends Plugin {
  settings: WhispererSettings = { ...DEFAULT_SETTINGS };

  private index: SyncIndex = {};
  private lastSyncAt: number | null = null;

  /** Изменения, накопленные с прошлой отправки. Множества, а не списки: одну и
   *  ту же заметку правят по десять раз подряд, и отправить её надо один. */
  private readonly dirty = new Set<string>();
  private readonly deleted = new Set<string>();

  private statusBar: HTMLElement | null = null;
  private debounceTimer: number | null = null;
  private intervalId: number | null = null;
  private syncing = false;
  /** Правка пришла во время отправки — синхронизацию надо повторить, иначе она
   *  осталась бы неотправленной до следующего события. */
  private rerunRequested = false;

  async onload(): Promise<void> {
    await this.loadSettings();
    registerBrandIcon();

    this.addSettingTab(new WhispererSettingTab(this.app, this));

    this.statusBar = this.addStatusBarItem();
    this.renderStatus();

    this.addRibbonIcon(BRAND_ICON, t("ribbon"), () => {
      void this.sync({ full: false, manual: true });
    });

    this.addCommand({
      id: "sync-changed-notes",
      name: t("commandSync"),
      callback: () => void this.sync({ full: false, manual: true }),
    });
    this.addCommand({
      id: "full-resync",
      name: t("commandFullSync"),
      callback: () => void this.sync({ full: true, manual: true }),
    });
    this.addCommand({
      id: "check-connection",
      name: t("commandCheck"),
      callback: () => void this.checkConnection(),
    });

    // Подписка ОТКЛАДЫВАЕТСЯ до готовности хранилища: при старте Obsidian
    // «создаёт» каждый файл заново, и без этого первая же загрузка редактора
    // выглядела бы как правка всего хранилища сразу.
    this.app.workspace.onLayoutReady(() => {
      this.registerEvent(this.app.vault.on("create", (file) => this.markDirty(file)));
      this.registerEvent(this.app.vault.on("modify", (file) => this.markDirty(file)));
      this.registerEvent(this.app.vault.on("delete", (file) => this.markDeleted(file.path)));
      this.registerEvent(
        this.app.vault.on("rename", (file, oldPath) => {
          // Переименование — это удаление и добавление: у заметки другой путь,
          // а путь и есть её опознавательный признак на сервере.
          this.markDeleted(oldPath);
          this.markDirty(file);
        }),
      );
      this.restartTimers();
    });
  }

  onunload(): void {
    this.clearTimers();
  }

  // ── настройки и состояние ──────────────────────────────────────────────

  async loadSettings(): Promise<void> {
    const stored = (await this.loadData()) as Partial<PluginData> | null;
    this.settings = { ...DEFAULT_SETTINGS, ...(stored?.settings ?? {}) };
    this.index = stored?.index ?? {};
    this.lastSyncAt = stored?.lastSyncAt ?? null;
  }

  async saveSettings(): Promise<void> {
    await this.persist();
    this.renderStatus();
  }

  async forgetSyncState(): Promise<void> {
    // Чистится ТОЛЬКО память устройства. Из базы знаний ничего не удаляется:
    // «я забыл, что отправлял» и «этого больше не нужно» — разные намерения, и
    // путать их значит терять чужие данные по нажатию кнопки в настройках.
    this.index = {};
    this.lastSyncAt = null;
    await this.persist();
    this.renderStatus();
  }

  private async persist(): Promise<void> {
    const data: PluginData = {
      settings: this.settings,
      index: this.index,
      lastSyncAt: this.lastSyncAt,
    };
    await this.saveData(data);
  }

  // ── расписание ─────────────────────────────────────────────────────────

  restartTimers(): void {
    this.clearTimers();
    if (!this.settings.autoSync) return;
    this.intervalId = window.setInterval(
      () => void this.sync({ full: true, manual: false }),
      this.settings.syncIntervalMinutes * 60_000,
    );
    // Регистрируем у хозяина: иначе таймер пережил бы выключение плагина и
    // продолжал бы ходить в сеть от имени того, кто его уже отключил.
    this.registerInterval(this.intervalId);
  }

  private clearTimers(): void {
    if (this.debounceTimer !== null) {
      window.clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private markDirty(file: TAbstractFile): void {
    if (!(file instanceof TFile)) return;
    if (isExcluded(file.path, this.settings.excludedFolders)) return;
    this.dirty.add(file.path);
    this.scheduleSync();
  }

  private markDeleted(path: string): void {
    this.dirty.delete(path);
    this.deleted.add(path);
    this.scheduleSync();
  }

  private scheduleSync(): void {
    if (!this.settings.autoSync) return;
    if (this.debounceTimer !== null) window.clearTimeout(this.debounceTimer);
    this.debounceTimer = window.setTimeout(
      () => void this.sync({ full: false, manual: false }),
      this.settings.syncDelaySeconds * 1000,
    );
  }

  // ── синхронизация ──────────────────────────────────────────────────────

  async checkConnection(): Promise<void> {
    const api = this.api();
    if (api === null) {
      new Notice(t("noticeNoToken"));
      return;
    }
    try {
      const status = await api.status();
      new Notice(
        t("checkOk", {
          name: status.displayName,
          notes: status.notes,
          used: humanBytes(status.usedBytes),
          limit: humanBytes(status.limitBytes),
        }),
      );
    } catch (error) {
      new Notice(t("checkFailed", { reason: this.explain(error) }));
    }
  }

  async sync(options: { full: boolean; manual: boolean }): Promise<void> {
    const api = this.api();
    if (api === null) {
      if (options.manual) new Notice(t("noticeNoToken"));
      this.renderStatus();
      return;
    }
    if (this.syncing) {
      // Второй запуск не ставится в очередь параллельно: две отправки одних и
      // тех же заметок — это двойная работа сервера и гонка за указатель.
      this.rerunRequested = true;
      return;
    }

    this.syncing = true;
    // Снимок изменений забирается ДО отправки, а накопитель очищается сразу:
    // правки, пришедшие в процессе, попадут в следующий заход, а не потеряются
    // при очистке после него.
    const dirty = new Set(this.dirty);
    const deleted = new Set(this.deleted);
    this.dirty.clear();
    this.deleted.clear();

    const engine = new SyncEngine(
      this.app,
      api,
      this.index,
      () => this.persist(),
      (done, total) => this.renderProgress(done, total),
    );

    try {
      const outcome = await engine.run(
        { full: options.full, dirty, deleted },
        this.settings.excludedFolders,
      );
      this.lastSyncAt = Date.now();
      await this.persist();

      if (options.manual) {
        if (outcome.sent === 0 && outcome.removed === 0) {
          new Notice(t("noticeNothingToDo"));
        } else {
          new Notice(t("noticeSynced", { sent: outcome.sent, removed: outcome.removed }));
        }
      }
      if (outcome.skippedTooLarge > 0) {
        new Notice(t("noticeTooLarge", { count: outcome.skippedTooLarge }));
      }
    } catch (error) {
      // Неотправленное возвращается в накопитель — иначе правка исчезла бы
      // вместе с неудачной попыткой, и заметить это можно было бы только по
      // отсутствию ответа ассистента.
      for (const path of dirty) this.dirty.add(path);
      for (const path of deleted) this.deleted.add(path);

      if (options.manual || isFatal(error)) new Notice(this.explain(error));
    } finally {
      this.syncing = false;
      this.renderStatus();
      if (this.rerunRequested) {
        this.rerunRequested = false;
        this.scheduleSync();
      }
    }
  }

  private api(): WhispererApi | null {
    const api = new WhispererApi(this.settings.serverUrl, this.settings.token);
    return api.configured ? api : null;
  }

  /** Отказ → фраза, по которой понятно, ЧТО делать. Коды разные не для
   *  красоты: «переподключите хранилище», «нужна подписка» и «освободите
   *  место» — три разных действия, и общее «ошибка» не помогает ни в одном. */
  private explain(error: unknown): string {
    if (error instanceof ApiError) {
      if (error.isAuthFailure) return t("noticeTokenInvalid");
      if (error.status === 403) return t("noticeSubscription");
      if (error.status === 413) return t("noticeQuota");
      if (error.status === 429) return t("noticeRateLimited");
    }
    return t("noticeUnavailable");
  }

  // ── строка состояния ───────────────────────────────────────────────────

  private renderProgress(done: number, total: number): void {
    this.statusBar?.setText(t("statusSyncing", { done, total }));
  }

  private renderStatus(): void {
    if (this.statusBar === null) return;
    if (!this.settings.token.trim()) {
      this.statusBar.setText(t("statusNoToken"));
      return;
    }
    this.statusBar.setText(t("statusIdle", { when: this.lastSyncLabel() }));
  }

  private lastSyncLabel(): string {
    if (this.lastSyncAt === null) return "—";
    return new Date(this.lastSyncAt).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
}

function humanBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(0)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

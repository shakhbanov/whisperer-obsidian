/**
 * Строки интерфейса плагина.
 *
 * Свой крошечный словарь, а не библиотека: в Obsidian нет встроенного i18n для
 * плагинов, а тянуть в бандл целый фреймворк ради трёх десятков строк — это
 * лишние килобайты у каждого, кто ставит плагин.
 *
 * Язык берётся из САМОГО Obsidian (его настройка интерфейса), а не из языка
 * платформы: человек читает эти строки внутри редактора, рядом с его
 * собственными надписями, и они обязаны быть на одном языке с ними.
 */

type Strings = {
  settingsHeading: string;
  serverName: string;
  serverDesc: string;
  tokenName: string;
  tokenDesc: string;
  tokenPlaceholder: string;
  checkButton: string;
  checkOk: string;
  checkFailed: string;
  autoSyncName: string;
  autoSyncDesc: string;
  delayName: string;
  delayDesc: string;
  intervalName: string;
  intervalDesc: string;
  excludeName: string;
  excludeDesc: string;
  excludePlaceholder: string;
  dangerHeading: string;
  fullSyncName: string;
  fullSyncDesc: string;
  fullSyncButton: string;
  forgetName: string;
  forgetDesc: string;
  forgetButton: string;
  forgetDone: string;
  commandSync: string;
  commandFullSync: string;
  commandCheck: string;
  ribbon: string;
  statusIdle: string;
  statusSyncing: string;
  statusOffline: string;
  statusNoToken: string;
  noticeNoToken: string;
  noticeTokenInvalid: string;
  noticeQuota: string;
  noticeUnavailable: string;
  noticeRateLimited: string;
  noticeSubscription: string;
  noticeSynced: string;
  noticeNothingToDo: string;
  noticeTooLarge: string;
  usage: string;
};

const EN: Strings = {
  settingsHeading: "Connection",
  serverName: "Server",
  serverDesc: "Whisperer address. Change it only if you use a self-hosted instance.",
  tokenName: "Vault token",
  tokenDesc:
    "Whisperer → Knowledge base → Sources → Obsidian. The token is shown once, right after you connect the vault.",
  tokenPlaceholder: "wsp_vault_…",
  checkButton: "Check connection",
  checkOk: "Connected: {name} — {notes} notes, {used} of {limit} used",
  checkFailed: "Could not connect: {reason}",
  autoSyncName: "Sync automatically",
  autoSyncDesc: "Send notes shortly after you edit them, and re-check the whole vault on a timer.",
  delayName: "Wait after an edit",
  delayDesc: "Seconds of quiet before edited notes are sent. Longer means fewer requests.",
  intervalName: "Full check every",
  intervalDesc: "Minutes between full vault checks. Catches edits made on another device.",
  excludeName: "Skip these folders",
  excludeDesc: "One path per line. Notes inside them are never sent.",
  excludePlaceholder: "Private\nDaily/Personal",
  dangerHeading: "Maintenance",
  fullSyncName: "Full resync",
  fullSyncDesc: "Compare the whole vault with the knowledge base and fix any difference.",
  fullSyncButton: "Run",
  forgetName: "Forget sync state",
  forgetDesc:
    "Clears what this device remembers about what was sent. The next sync re-checks every note. Nothing is deleted from the knowledge base.",
  forgetButton: "Forget",
  forgetDone: "Sync state cleared",
  commandSync: "Sync changed notes",
  commandFullSync: "Full resync",
  commandCheck: "Check connection",
  ribbon: "Sync with Whisperer",
  statusIdle: "Whisperer: {when}",
  statusSyncing: "Whisperer: syncing {done}/{total}",
  statusOffline: "Whisperer: offline",
  statusNoToken: "Whisperer: no token",
  noticeNoToken: "Whisperer: add the vault token in the plugin settings first.",
  noticeTokenInvalid:
    "Whisperer: the vault token is not accepted. Reconnect the vault in Whisperer and paste the new token.",
  noticeQuota: "Whisperer: the knowledge base is full. Free some space and try again.",
  noticeUnavailable: "Whisperer: the service is not available right now. Will retry later.",
  noticeRateLimited: "Whisperer: too many requests. Will retry later.",
  noticeSubscription: "Whisperer: an active subscription is required to use the knowledge base.",
  noticeSynced: "Whisperer: {sent} sent, {removed} removed",
  noticeNothingToDo: "Whisperer: everything is already up to date",
  noticeTooLarge: "Whisperer: {count} note(s) are too large and were skipped",
  usage: "{used} of {limit} used",
};

const RU: Strings = {
  settingsHeading: "Подключение",
  serverName: "Сервер",
  serverDesc: "Адрес Whisperer. Меняйте, только если у вас собственная установка.",
  tokenName: "Токен хранилища",
  tokenDesc:
    "Whisperer → База знаний → Источники → Obsidian. Токен показывается один раз — сразу после подключения хранилища.",
  tokenPlaceholder: "wsp_vault_…",
  checkButton: "Проверить подключение",
  checkOk: "Подключено: {name} — заметок {notes}, занято {used} из {limit}",
  checkFailed: "Не удалось подключиться: {reason}",
  autoSyncName: "Синхронизировать автоматически",
  autoSyncDesc: "Отправлять заметки вскоре после правки и время от времени сверять всё хранилище.",
  delayName: "Пауза после правки",
  delayDesc: "Сколько секунд тишины ждать перед отправкой. Больше — реже запросы.",
  intervalName: "Полная сверка каждые",
  intervalDesc: "Минуты между полными сверками. Ловит правки, сделанные на другом устройстве.",
  excludeName: "Пропускать папки",
  excludeDesc: "По одному пути в строке. Заметки внутри них не отправляются никогда.",
  excludePlaceholder: "Личное\nДневник/Личное",
  dangerHeading: "Обслуживание",
  fullSyncName: "Полная пересинхронизация",
  fullSyncDesc: "Сверить всё хранилище с базой знаний и устранить расхождения.",
  fullSyncButton: "Запустить",
  forgetName: "Забыть состояние синхронизации",
  forgetDesc:
    "Очищает память этого устройства о том, что уже отправлено. Следующая синхронизация сверит все заметки заново. Из базы знаний ничего не удаляется.",
  forgetButton: "Забыть",
  forgetDone: "Состояние синхронизации очищено",
  commandSync: "Отправить изменённые заметки",
  commandFullSync: "Полная пересинхронизация",
  commandCheck: "Проверить подключение",
  ribbon: "Синхронизировать с Whisperer",
  statusIdle: "Whisperer: {when}",
  statusSyncing: "Whisperer: отправка {done}/{total}",
  statusOffline: "Whisperer: нет связи",
  statusNoToken: "Whisperer: нет токена",
  noticeNoToken: "Whisperer: сначала укажите токен хранилища в настройках плагина.",
  noticeTokenInvalid:
    "Whisperer: токен хранилища не принят. Переподключите хранилище в Whisperer и вставьте новый токен.",
  noticeQuota: "Whisperer: база знаний заполнена. Освободите место и попробуйте снова.",
  noticeUnavailable: "Whisperer: сервис сейчас недоступен. Попробуем позже.",
  noticeRateLimited: "Whisperer: слишком много запросов. Попробуем позже.",
  noticeSubscription: "Whisperer: для базы знаний нужна активная подписка.",
  noticeSynced: "Whisperer: отправлено {sent}, снято {removed}",
  noticeNothingToDo: "Whisperer: всё уже синхронизировано",
  noticeTooLarge: "Whisperer: слишком больших заметок пропущено: {count}",
  usage: "занято {used} из {limit}",
};

const DICTIONARIES: Record<string, Strings> = { en: EN, ru: RU };

function currentLanguage(): string {
  try {
    // Настройка языка самого Obsidian. Обёрнута в try: в мобильной сборке и в
    // тестовой среде localStorage может быть недоступен, и падать из-за надписи
    // плагин не вправе.
    return window.localStorage.getItem("language") || "en";
  } catch {
    return "en";
  }
}

const STRINGS = DICTIONARIES[currentLanguage()] ?? EN;

/** Строка с подстановками вида `{name}`. */
export function t(key: keyof Strings, vars: Record<string, string | number> = {}): string {
  return Object.entries(vars).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
    STRINGS[key],
  );
}

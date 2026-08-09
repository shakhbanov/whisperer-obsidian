/**
 * Настройки плагина и их экран.
 *
 * Токен хранится в `data.json` плагина — там же, где его хранят все плагины
 * Obsidian: своего хранилища секретов у редактора нет. Это честное ограничение,
 * и README о нём предупреждает: файл лежит ВНУТРИ хранилища, поэтому уезжает
 * вместе с ним в чужую синхронизацию и в git, если хранилище под ним.
 *
 * Отсюда же требование к самому токену: он умеет ровно одно — присылать заметки
 * в ОДНО хранилище знаний, и отзывается отключением источника, не трогая ни
 * аккаунт, ни другие устройства.
 */
import { App, Notice, PluginSettingTab, Setting } from "obsidian";

import { t } from "./i18n";
import type WhispererPlugin from "./main";

export interface WhispererSettings {
  serverUrl: string;
  token: string;
  autoSync: boolean;
  /** Секунды тишины после правки. Меньше — чаще запросы на каждый Ctrl+S. */
  syncDelaySeconds: number;
  /** Минуты между полными сверками. Ловят правки с другого устройства. */
  syncIntervalMinutes: number;
  /** Папки, которые не отправляются никогда. Пути от корня хранилища. */
  excludedFolders: string[];
}

export const DEFAULT_SETTINGS: WhispererSettings = {
  serverUrl: "https://whisperer.one",
  token: "",
  autoSync: true,
  // Полминуты: человек правит заметку очередями, и отправка на каждое нажатие
  // означала бы десятки запросов на одну мысль.
  syncDelaySeconds: 30,
  // Час: полная сверка читает всё хранилище, и чаще она не нужна — точечные
  // правки уезжают по событию, а не по расписанию.
  syncIntervalMinutes: 60,
  excludedFolders: [],
}

export class WhispererSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private readonly plugin: WhispererPlugin,
  ) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // Заголовка в начале НЕТ намеренно: guidelines Obsidian просят открывать
    // вкладку сразу настройками, а разделы озаглавливать только со второго.
    // Заголовок «Подключение» здесь означал бы, что вся вкладка — про него.
    new Setting(containerEl)
      .setName(t("serverName"))
      .setDesc(t("serverDesc"))
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.serverUrl)
          .setValue(this.plugin.settings.serverUrl)
          .onChange(async (value) => {
            this.plugin.settings.serverUrl = value.trim() || DEFAULT_SETTINGS.serverUrl;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName(t("tokenName"))
      .setDesc(t("tokenDesc"))
      .addText((text) => {
        text
          .setPlaceholder(t("tokenPlaceholder"))
          .setValue(this.plugin.settings.token)
          .onChange(async (value) => {
            this.plugin.settings.token = value.trim();
            await this.plugin.saveSettings();
          });
        // Значение не должно быть видно через плечо и не должно попасть в
        // автозаполнение как обычный текст.
        text.inputEl.type = "password";
        text.inputEl.autocomplete = "off";
      });

    new Setting(containerEl).addButton((button) =>
      button
        .setButtonText(t("checkButton"))
        .setCta()
        .onClick(async () => {
          button.setDisabled(true);
          try {
            await this.plugin.checkConnection();
          } finally {
            button.setDisabled(false);
          }
        }),
    );

    new Setting(containerEl)
      .setName(t("autoSyncName"))
      .setDesc(t("autoSyncDesc"))
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.autoSync).onChange(async (value) => {
          this.plugin.settings.autoSync = value;
          await this.plugin.saveSettings();
          this.plugin.restartTimers();
        }),
      );

    new Setting(containerEl)
      .setName(t("delayName"))
      .setDesc(t("delayDesc"))
      .addSlider((slider) =>
        slider
          .setLimits(5, 300, 5)
          .setValue(this.plugin.settings.syncDelaySeconds)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.syncDelaySeconds = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName(t("intervalName"))
      .setDesc(t("intervalDesc"))
      .addSlider((slider) =>
        slider
          .setLimits(15, 720, 15)
          .setValue(this.plugin.settings.syncIntervalMinutes)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.syncIntervalMinutes = value;
            await this.plugin.saveSettings();
            this.plugin.restartTimers();
          }),
      );

    new Setting(containerEl)
      .setName(t("excludeName"))
      .setDesc(t("excludeDesc"))
      .addTextArea((area) => {
        area
          .setPlaceholder(t("excludePlaceholder"))
          .setValue(this.plugin.settings.excludedFolders.join("\n"))
          .onChange(async (value) => {
            this.plugin.settings.excludedFolders = value
              .split("\n")
              .map((line) => line.trim().replace(/^\/+|\/+$/g, ""))
              .filter((line) => line.length > 0);
            await this.plugin.saveSettings();
          });
        area.inputEl.rows = 4;
        area.inputEl.addClass("whisperer-exclude-input");
      });

    new Setting(containerEl).setName(t("dangerHeading")).setHeading();

    new Setting(containerEl)
      .setName(t("fullSyncName"))
      .setDesc(t("fullSyncDesc"))
      .addButton((button) =>
        button.setButtonText(t("fullSyncButton")).onClick(() => {
          void this.plugin.sync({ full: true, manual: true });
        }),
      );

    new Setting(containerEl)
      .setName(t("forgetName"))
      .setDesc(t("forgetDesc"))
      .addButton((button) =>
        button
          .setButtonText(t("forgetButton"))
          .setWarning()
          .onClick(async () => {
            await this.plugin.forgetSyncState();
            new Notice(t("forgetDone"));
          }),
      );
  }
}

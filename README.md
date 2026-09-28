<p align="center">
  <img src="assets/logo.png" alt="Whisperer" width="96" height="96">
</p>

# Whisperer Sync

Keep your Obsidian vault in sync with your [Whisperer](https://whisperer.one) knowledge
base, so the assistant answers from **your** notes — not from what it guessed.

The sync is one-way by design: notes go from the vault to Whisperer, and nothing ever
comes back. The plugin does not create, rewrite, or delete a single line in your vault.

---

## What it does

- sends new and edited notes shortly after you stop typing;
- removes notes from the knowledge base when you delete them in the vault;
- handles renames as a move, so a note never ends up in the index twice;
- re-checks the whole vault on a timer, which catches edits made on another device;
- skips folders you exclude, and never touches anything outside the allowed file types.

Supported files: `.md`, `.markdown`, `.txt`, `.canvas`.

## What is sent

Exactly two things per note: **its path inside the vault** and **its text**.

No file system paths outside the vault, no attachments, no images, no plugin data, no
vault name, no telemetry. Notes are stored in the knowledge base of your own account and
are searchable only by you.

## Install

### From Obsidian (once the plugin is listed)

Settings → Community plugins → Browse → search for **Whisperer Sync** → Install → Enable.

### Manually

1. Download `main.js`, `manifest.json` and `styles.css` from the
   [latest release](https://github.com/shakhbanov/whisperer-obsidian/releases/latest).
2. Put them into `<your vault>/.obsidian/plugins/whisperer-sync/`.
3. Restart Obsidian and enable the plugin in Settings → Community plugins.

## Setup

1. In Whisperer, open **Knowledge base → Sources → Obsidian** and connect the vault.
2. Copy the token that appears. **It is shown only once** — the server keeps a
   fingerprint of it, not the value. Lost it? Reconnect the vault to get a new one.
3. In Obsidian, open the plugin settings, paste the token and press **Check connection**.
4. Run **Full resync** once to send what is already in the vault.

A paid Whisperer subscription is required: the knowledge base is a paid feature, and the
check runs on every request, not once at setup.

## Settings

| Setting | What it does |
|---|---|
| Server | Whisperer address. Change it only for a self-hosted instance. |
| Vault token | Identifies the vault. Revoked by disconnecting the source in Whisperer. |
| Sync automatically | Send edits on a delay and re-check the vault on a timer. |
| Wait after an edit | Seconds of quiet before edited notes are sent (default 30). |
| Full check every | Minutes between full vault checks (default 60). |
| Skip these folders | One path per line. Notes inside are never sent. |
| Full resync | Compare the whole vault with the knowledge base and fix any difference. |
| Forget sync state | Clears what this device remembers. Deletes nothing from the knowledge base. |

## Where the token is stored

In `.obsidian/plugins/whisperer-sync/data.json`, inside your vault — Obsidian gives
plugins no secret storage, so every plugin that talks to a service does the same.

Two consequences worth knowing:

- if your vault is in git or in a third-party sync, the token travels with it. Add that
  file to your ignore list;
- the token can do exactly one thing: send notes into **one** knowledge-base source. It
  cannot read your notes back, cannot touch your account, and disconnecting the source in
  Whisperer revokes it without affecting anything else.

## Limits

Set by the server and read by the plugin at every sync, so they are never out of date:

- 1 MB per note — bigger notes are skipped, and the plugin tells you how many;
- 50 notes and 8 MB per request — larger vaults are sent in batches;
- your knowledge-base quota (100 MB by default) applies to everything together.

An interrupted sync resumes where it stopped: what was delivered is remembered after each
batch, not at the end.

## Development

```bash
npm install
npm run dev     # watch build into main.js
npm run build   # typecheck + minified production build
```

To test in a real vault, symlink or copy `main.js`, `manifest.json` and `styles.css` into
`<vault>/.obsidian/plugins/whisperer-sync/`.

Releases are cut by tagging: `npm version patch && git push --follow-tags`. The GitHub
workflow builds the plugin and attaches the three files to the release, which is the shape
Obsidian's plugin catalogue expects.

## License

MIT — see [LICENSE](LICENSE).

---

## По-русски

**Whisperer Sync** держит хранилище Obsidian в синхронизации с базой знаний
[Whisperer](https://whisperer.one): ассистент отвечает по вашим заметкам, а не по
догадкам.

Поток данных один — из хранилища в Whisperer. Плагин ничего не скачивает и не правит в
ваших заметках.

**Как подключить.** В Whisperer: «База знаний → Источники → Obsidian» → подключить
хранилище → скопировать токен (он показывается **один раз**). В Obsidian: настройки
плагина → вставить токен → «Проверить подключение» → «Полная пересинхронизация».

**Что уезжает:** путь заметки внутри хранилища и её текст. Ничего больше — ни вложений,
ни картинок, ни имени хранилища, ни телеметрии.

**Где лежит токен:** в `data.json` плагина внутри хранилища — своего хранилища секретов
у Obsidian нет. Если хранилище под git или под чужой синхронизацией, добавьте этот файл
в исключения. Токен умеет ровно одно: присылать заметки в одно хранилище знаний;
отключение источника в Whisperer отзывает его, не трогая аккаунт.

https://whisperer.one

# Saladict 沙拉查词 (Fork)

> This is a fork of [crimx/ext-saladict](https://github.com/crimx/ext-saladict) with Chrome Manifest V3 support and additional improvements.

[![Version](https://img.shields.io/github/release/doraemonkeys/ext-saladict.svg?label=version)](https://github.com/doraemonkeys/ext-saladict/releases)
[![License](https://img.shields.io/github/license/doraemonkeys/ext-saladict.svg?colorB=44cc11)](https://github.com/doraemonkeys/ext-saladict/blob/dev/LICENSE)

Chrome/Firefox WebExtension. Feature-rich inline translator with PDF support.

Chrome/Firefox 浏览器插件，网页划词翻译。

## Fork Changes

Compared to the [original project](https://github.com/crimx/ext-saladict), this fork includes the following improvements:

- **Chrome Manifest V3 Support** — Migrated background page to service worker, added offscreen document and fetch adapter for MV3 compliance.
- **Bing Translate Dictionary** — Added Bing Translate as a new dictionary source.
- **Updated Dictionary Engines** — Refactored dictionary engines for MV3 compatibility with improved error handling.
- **Enhanced PDF.js** — Improved PDF download process with redirect handling and extraction improvements.

## Downloads

- See [releases](https://github.com/doraemonkeys/ext-saladict/releases) for the latest build.
- Download the `.zip` file for your browser (Chrome or Firefox) and load it as an unpacked extension.

## Build from Source

Requires Node.js 16.x and Yarn 1.x (see [.mise.toml](./.mise.toml)).

```bash
git clone https://github.com/doraemonkeys/ext-saladict.git
cd ext-saladict
yarn install
yarn pdf
```

Add a `.env` file following the [`.env.example`](./.env.example) format (leave values empty if you don't use those dictionaries).

```bash
yarn build
```

Build artifacts can be found in `build/` directory:
- `build/chrome/` — Chrome extension (MV3)
- `build/firefox/` — Firefox add-on

## Development

See the [contributing guide](./CONTRIBUTING.md).

## Credits

- Original project: [crimx/ext-saladict](https://github.com/crimx/ext-saladict) by [CRIMX](https://github.com/crimx)

## License

[MIT](./LICENSE)

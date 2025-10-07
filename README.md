# Json DeepL CLI

<!-- automd:badges color=purple -->

[![npm version](https://img.shields.io/npm/v/@jsondeepl/cli?color=purple)](https://npmjs.com/package/@jsondeepl/cli)
[![npm downloads](https://img.shields.io/npm/dm/@jsondeepl/cli?color=purple)](https://npm.chart.dev/@jsondeepl/cli)

<!-- /automd -->

A CLI tool to translate JSON files using JsonDeepL API

## Usage

### 1. Install the package:

```sh
npm i -g @jsondeepl/cli
```

### 2. Run command in your terminal:

```sh
jsondeepl
```

First time you run the command for a project, it will automatically create a `/jsondeepl` directory and `/jsondeepl/config.json` configuration file.
You will need Your [JsonDeepL API key](https://jsondeepl.com/dashboard/api-keys).

```json
// jsondeepl/config.json
{
  "apiKey": "",
  "engine": "deepl",
  "formality": "prefer_less",
  "langDir": "./i18n/locales",
  "options": {
    "autoMerge": true,
    "prompt": true
  },
  "source": "en",
  "target": [
    "ar",
    "bg",
    "cs",
    "da",
    "de",
    "el",
    "en-GB",
    "en-US",
    "es",
    "et",
    "fi",
    "fr",
    "hu",
    "id",
    "it",
    "ja",
    "ko",
    "lt",
    "lv",
    "nb",
    "nl",
    "pl",
    "pt-BR",
    "pt-PT",
    "ro",
    "ru",
    "sk",
    "sl",
    "sv",
    "tr",
    "uk",
    "zh"
  ]
}
```

## Development

<details>

<summary>local development</summary>

- Clone this repository
- Install latest LTS version of [Node.js](https://nodejs.org/en/)
- Enable [Corepack](https://github.com/nodejs/corepack) using `corepack enable`
- Install dependencies using `pnpm install`
- Run interactive tests using `pnpm dev`

</details>

## License

<!-- automd:contributors license=MIT -->

Published under the [MIT](https://github.com/jsondeepl/cli/blob/main/LICENSE) license.
Made by [community](https://github.com/jsondeepl/cli/graphs/contributors) 💛
<br><br>
<a href="https://github.com/jsondeepl/cli/graphs/contributors">
<img src="https://contrib.rocks/image?repo=jsondeepl/cli" />
</a>

<!-- /automd -->

# Changelog


## v1.0.0

[compare changes](https://github.com/jsondeepl/cli/compare/v0.0.10...v1.0.0)

First stable release. `@jsondeepl/cli` has been translating JSON i18n files directly through the caller's own DeepL API key for several releases now — this marks that flow, along with a round of correctness and performance hardening, as stable.

### 🚀 Enhancements

- Batch translation requests up to 50 texts per DeepL call instead of one request per string, cutting round-trips substantially for larger translation jobs ([670d299](https://github.com/jsondeepl/cli/commit/670d299))
- Translate all target languages concurrently, while a shared rate limiter keeps the real request rate to DeepL capped no matter how many languages run at once ([670d299](https://github.com/jsondeepl/cli/commit/670d299))
- Merge translations and remove stale keys in a single read/write pass per target locale file instead of two ([670d299](https://github.com/jsondeepl/cli/commit/670d299))

### 🩹 Fixes

- Prevent a rare unhandled-rejection crash from the translation timeout race ([670d299](https://github.com/jsondeepl/cli/commit/670d299))
- Stop the `:name` placeholder pattern from swallowing legitimate colon text like times (`10:30`) and scores (`3:2`) ([670d299](https://github.com/jsondeepl/cli/commit/670d299))
- Apply the documented default when `config.json` is missing its `options` object, instead of crashing later ([8089ca7](https://github.com/jsondeepl/cli/commit/8089ca7))
- Avoid a redundant DeepL usage API call on every run ([8089ca7](https://github.com/jsondeepl/cli/commit/8089ca7))

### 🏡 Chore

- Migrate tooling from npm to pnpm ([9bba8cb](https://github.com/jsondeepl/cli/commit/9bba8cb))
- Rework CI for pnpm; releases are now a deliberate local step rather than triggered by every push ([d68d2de](https://github.com/jsondeepl/cli/commit/d68d2de))

### 📖 Documentation

- Correct the README for the direct-DeepL integration and remove the stale copilot-instructions.md ([7ef0406](https://github.com/jsondeepl/cli/commit/7ef0406))

### ❤️ Contributors

- Kian Salout ([@Kiansa](https://github.com/Kiansa))

## v0.0.10

[compare changes](https://github.com/jsondeepl/cli/compare/v0.0.9...v0.0.10)

### 🚀 Enhancements

- 🚀 new per-language translation payloads and enhance configuration handling ([0992e82](https://github.com/jsondeepl/cli/commit/0992e82))

### ❤️ Contributors

- Kian Salout ([@Kiansa](https://github.com/Kiansa))

## v0.0.9

[compare changes](https://github.com/jsondeepl/cli/compare/v0.0.8...v0.0.9)

### 🩹 Fixes

- Load environment variables from .env file ([42d7710](https://github.com/jsondeepl/cli/commit/42d7710))

### ❤️ Contributors

- Kian Salout ([@Kiansa](https://github.com/Kiansa))

## v0.0.8

[compare changes](https://github.com/jsondeepl/cli/compare/v0.0.7...v0.0.8)

### 🚀 Enhancements

- 🚀 Enhance configuration and user validation logic ([c75fb49](https://github.com/jsondeepl/cli/commit/c75fb49))

### ❤️ Contributors

- Kian Salout ([@Kiansa](https://github.com/Kiansa))

## v0.0.7

[compare changes](https://github.com/jsondeepl/cli/compare/v0.0.6...v0.0.7)

### 🤖 CI

- Update id-token permission comment for clarity ([57050fa](https://github.com/jsondeepl/cli/commit/57050fa))

### ❤️ Contributors

- Kian Salout ([@Kiansa](https://github.com/Kiansa))

## v0.0.6

[compare changes](https://github.com/jsondeepl/cli/compare/v0.0.5...v0.0.6)

### 🏡 Chore

- Update dependencies and refactor consola import ([ebd739e](https://github.com/jsondeepl/cli/commit/ebd739e))

### ❤️ Contributors

- Kian Salout ([@Kiansa](https://github.com/Kiansa))

## v0.0.5

[compare changes](https://github.com/jsondeepl/cli/compare/v0.0.4...v0.0.5)

### 🩹 Fixes

- Missing consola dep ([2441403](https://github.com/jsondeepl/cli/commit/2441403))

### ❤️ Contributors

- Kian Salout ([@Kiansa](https://github.com/Kiansa))

## v0.0.4

[compare changes](https://github.com/jsondeepl/cli/compare/v0.0.3...v0.0.4)

### 🩹 Fixes

- Executable ([ba72337](https://github.com/jsondeepl/cli/commit/ba72337))

### ❤️ Contributors

- Kian Salout ([@Kiansa](https://github.com/Kiansa))

## v0.0.3

[compare changes](https://github.com/jsondeepl/cli/compare/v0.0.2...v0.0.3)

### 🤖 CI

- Github release fix ([46446f9](https://github.com/jsondeepl/cli/commit/46446f9))

### ❤️ Contributors

- Kian Salout ([@Kiansa](https://github.com/Kiansa))

## v0.0.2

[compare changes](https://github.com/jsondeepl/cli/compare/v0.0.1...v0.0.2)

### 🩹 Fixes

- **ci:** Release automation ([2beee1d](https://github.com/jsondeepl/cli/commit/2beee1d))

### 🏡 Chore

- **release:** V0.0.1 ([5a26c42](https://github.com/jsondeepl/cli/commit/5a26c42))
- **release:** V0.0.1 ([4d02a2d](https://github.com/jsondeepl/cli/commit/4d02a2d))
- **release:** V0.0.1 ([5a235d8](https://github.com/jsondeepl/cli/commit/5a235d8))
- **release:** V0.0.1 ([6944be4](https://github.com/jsondeepl/cli/commit/6944be4))
- **release:** V0.0.1 ([7d7037d](https://github.com/jsondeepl/cli/commit/7d7037d))

### ❤️ Contributors

- Kian Salout ([@Kiansa](https://github.com/Kiansa))

## v0.0.1

[compare changes](https://github.com/jsondeepl/cli/compare/v0.0.1...v0.0.1)

### 🏡 Chore

- **release:** V0.0.1 ([b020dd3](https://github.com/jsondeepl/cli/commit/b020dd3))
- **release:** V0.0.1 ([d5ed01c](https://github.com/jsondeepl/cli/commit/d5ed01c))
- **release:** V0.0.1 ([5a26c42](https://github.com/jsondeepl/cli/commit/5a26c42))
- **release:** V0.0.1 ([4d02a2d](https://github.com/jsondeepl/cli/commit/4d02a2d))
- **release:** V0.0.1 ([5a235d8](https://github.com/jsondeepl/cli/commit/5a235d8))
- **release:** V0.0.1 ([6944be4](https://github.com/jsondeepl/cli/commit/6944be4))

### ❤️ Contributors

- Kian Salout ([@Kiansa](https://github.com/Kiansa))


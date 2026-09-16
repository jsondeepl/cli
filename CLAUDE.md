# CLAUDE.md

`@jsondeepl/cli` (bin: `jsondeepl`) — a CLI that translates JSON i18n files directly via the DeepL API, using the caller's own DeepL API key. No accounts, no backend of ours involved anywhere in the flow.

## Architecture

### Core workflow (`src/index.ts`)

1. Load config from `jsondeepl/config.json` (`src/config.ts`)
2. Parse the source JSON from `config.langDir/{source}.json`
3. Diff against the last-known state (`jsondeepl/{source}-lock.json`) to find only new/changed keys
4. Build per-language payloads — a brand-new target language gets the full source; an existing one gets only the diff
5. Count characters, check the caller's real DeepL usage/quota, warn if this job might exceed it, and (if `options.prompt`) confirm before proceeding
6. Translate directly via `deepl-node`, all target languages concurrently, batched per request and with retry/backoff
7. Update the lock file, then merge the new translations into each target locale file and remove keys that no longer exist in source, in one read/write pass per file

### Configuration (`src/config.ts`)

- Auto-creates `jsondeepl/config.json` with `defaultConfig` on first run (source, target languages, `langDir`, `formality`, `options.prompt`).
- The DeepL API key is **never** stored in `jsondeepl/config.json`. It always comes from the `DEEPL_API_KEY` env var (loaded via `dotenv`, so a local `.env` file works too).
- `validateDeeplApiKey()` (`src/utils.ts`) confirms the key actually works — via `new Translator(apiKey).getUsage()` — before any file work happens; exits with a clear message on an `AuthorizationError`.

### Translation (`src/utils.ts`)

- `translateJSON`/`translateStrings` — flattens a JSON object's string leaves depth-first, then translates them in batches of up to `MAX_TEXTS_PER_REQUEST` (50, DeepL's per-request cap) via a single `translateText(string[], ...)` call per batch, instead of one request per string. `rebuildWithTranslations()` walks the same shape again to reassemble the nested object (including empty nested objects) from the flat translated list. Retries transient failures (`TooManyRequestsError`, `ConnectionError`, socket resets) with exponential backoff; `AuthorizationError`/`QuotaExceededError` are not retried.
- `getTranslator(apiKey)` caches one `Translator` instance per API key instead of constructing a new one per call.
- `useTranslateJSON` translates all target languages **concurrently** (`Promise.all`) for wall-clock speed, but every language's actual DeepL network call funnels through the module-level `scheduleRequest()` queue, which serializes requests with a fixed `REQUEST_GAP_MS` (200ms) gap between them. This caps the real request rate to DeepL at one call per gap **regardless of how many target languages are translating at once** — concurrency only shortens wall-clock time, it never multiplies request rate. Don't bypass `scheduleRequest()` when adding new DeepL calls that might run concurrently with translation.
- Interpolation placeholders (`{{mustache}}`, `{braces}`, `:blade`) are wrapped in ignored XML tags before sending to DeepL and unwrapped after, so translation doesn't mangle them. The `:blade` regex requires a preceding non-word character and a following letter/underscore, so it only matches `:name`-style placeholders — not colon-containing text like times (`10:30`) or ratios (`3:2`).
- `useDeeplUsage(apiKey, characterCount, promptConfirm, preFetchedUsage?)` — shows the caller's real DeepL character usage/limit, warns if this job might push them over it, and prompts to confirm (only when `promptConfirm` is true). Accepts an already-fetched `Usage` (from `validateDeeplApiKey`, via `config.usage`) to avoid a second `getUsage()` round-trip on every run. This is the same UX pattern the main site's web tool uses before translating (its `useDeeplUsage()`/quota-warning modal was modeled on this one).

### State management

- **Lock file** — `jsondeepl/{source}-lock.json`: the last-translated state of the source locale, used to compute the diff on the next run.
- **History** — `jsondeepl/history/{timestamp}/{lang}.json`: a snapshot of each translation job. Timestamp format comes from `formattedNewDate()`.
- `useExtract()`/`extractUniqueKeys()` — recursively diffs current source data against the lock file to find new/changed keys (deep, not shallow — nested objects are diffed key-by-key).
- `useMerging()`/`mergeFiles()` — deep-merges freshly translated keys into each target locale file, preserving existing translations for anything not in this run's payload, **then** removes any key that no longer exists in source (`findKeysToRemove()`/`removeKeysByPath()`) before writing — one read/write pass per target file. This is what `main()` calls; it's the only cleanup step in the normal CLI flow.
- `useCleanup()` — the same stale-key removal as a standalone function (its own read + write pass). No longer called from `main()` since `useMerging()` absorbed it, but kept as an independently testable/usable utility — don't remove it as "dead code," it still has direct test coverage.

### Language codes (`src/types/common.types.ts`)

`SourceLanguageCode`/`TargetLanguageCode` are re-exported directly from `deepl-node`, not hand-maintained — the CLI's supported-language list always matches whatever `deepl-node` version is actually installed, with nothing to keep in sync manually.

## Package management

- **pnpm**, not npm — install with `pnpm install`, run scripts with `pnpm run <script>` (or `pnpm <script>`).
- `pnpm-workspace.yaml` holds pnpm settings that used to live under a `"pnpm"` key in `package.json` (pnpm 10+ moved them): `shamefullyHoist: true`, and `allowBuilds` approving `@parcel/watcher`'s native build script (a transitive dep of `automd`, used for file watching — harmless, but pnpm blocks unapproved postinstall scripts by default).
- Do not commit `package-lock.json` — this project uses `pnpm-lock.yaml`.

## Build

- `obuild` (rolldown-based) bundles `src/index.ts` → `dist/index.mjs`, inlining every runtime dependency (`consola`, `pathe`, `dotenv`, `deepl-node` and its own deps) directly into the output. Nothing is required from `node_modules` at runtime.
- **This is why runtime dependencies live in `devDependencies`, not `dependencies`** — that's deliberate, not a bug. If you add a new runtime import, it goes in `devDependencies` to match.
- `pnpm run build` runs `obuild`; `pnpm run prepack` runs it automatically before publish.

## Testing

- Vitest, run via `pnpm exec vitest run` (`pnpm run test` also runs lint + type-check first).
- To mock `deepl-node`'s `Translator` class in a test, define a real ES class — `vi.fn().mockImplementation(() => ({...}))` does not reliably work as a constructor mock:
  ```ts
  vi.mock('deepl-node', () => ({
    Translator: class {
      translateText = mockTranslateText
      getUsage = mockGetUsage
    },
    AuthorizationError: class AuthorizationError extends Error {},
    QuotaExceededError: class QuotaExceededError extends Error {},
  }))
  ```
- See `test/integration.test.ts` and `test/utils.coverage.test.ts` for the established pattern.

## CI & releases

- `.github/workflows/checks.yml` (CI) — lint, type-check, test+coverage on push/PR to `main`/`dev`; also `workflow_call`-able. Uses `pnpm/action-setup` + `pnpm install --frozen-lockfile`, not npm.
- `.github/workflows/autofix.yml` — runs `pnpm run lint:fix` on push/PR and commits the result back via `autofix-ci/action`.
- `.github/workflows/status.yml` — fails loudly if the CI workflow run it's watching didn't succeed; a simple external status gate.
- **There is no release workflow.** Releasing is a deliberate local-only action: `pnpm run release` (test → `changelogen` version bump/changelog → `pnpm publish` → `git push --follow-tags`), run by hand whenever you actually want to ship. Nothing publishes automatically from a push to `main` — don't reintroduce a push-triggered release workflow without being asked; that was removed on purpose (npm provenance/OIDC only works from CI anyway, so a local release script can't use `--provenance`).
- `pnpm run release` runs `changelogen --release` with no explicit bump type, so it auto-detects patch/minor/major from Conventional Commits since the last tag (`feat:`→minor, `fix:`→patch, breaking→major). `release:patch`/`release:minor`/`release:major` force a specific level. **While the version starts with `0.`**, changelogen silently downgrades an auto-detected or explicit `major`→`minor` and `minor`→`patch` (its pre-1.0 safety rule) — so `release:major` on a `0.x` version will NOT produce `1.0.0`. To land an exact version (e.g. the first `1.0.0`), bypass the bump logic entirely with `-r <version>`: `pnpm dlx changelogen@latest --release -r 1.0.0`.
- **`changelogen --release` also opens/creates a GitHub Release by default**, built from its own auto-generated commit-list markdown — unrelated to whatever you've hand-written in `CHANGELOG.md`, even with `--no-output` (which only stops it touching the `CHANGELOG.md` file, not the separate in-memory markdown it hands to the GitHub Release step). Without a `GITHUB_TOKEN`/`gh auth` available to it, this opens a browser tab with an auto-filled draft. If you've hand-written a nicer `CHANGELOG.md` entry for this release (e.g. a curated v1.0.0 summary instead of a flat commit dump) and want the GitHub Release to actually reflect it, add `--no-github` and paste the real entry in yourself: `pnpm dlx changelogen@latest --release --no-output --no-github -r 1.0.0 && pnpm publish && git push --follow-tags`.

## Conventions

- `use`-prefixed function names for main workflow functions (`useExtract`, `useCleanup`, `useDeeplUsage`).
- `async function` declarations (not arrow functions) for the main workflow functions; JSDoc on non-trivial utilities.
- `pathe` for all path operations (cross-platform); `fs.promises` for async file I/O, `fs.writeFileSync` for simple synchronous writes.
- `consola` for all user-facing output (`start`/`success`/`warn`/`error`/`info`/`prompt`); `process.exit(1)` for fatal errors, `process.exit(0)` for a clean user-initiated cancellation.
- ESLint via `@antfu/eslint-config`: `pnpm run lint` / `pnpm run lint:fix` (the latter also runs `automd` to refresh README badges/contributor list).
- Licensed under MIT.

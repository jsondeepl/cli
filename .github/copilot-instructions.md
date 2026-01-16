# JsonDeepL CLI - Copilot Instructions

## Project Overview
This is a TypeScript CLI tool for translating JSON files using the JsonDeepL API. The CLI manages translation workflows including extraction of new keys, API communication, state management with lock files, and merging translations back into locale files.

## Architecture & Key Components

### Core Workflow (src/index.ts)
The main process follows this sequence:
1. Load config from `jsondeepl/config.json`
2. Parse source JSON from `config.langDir/source.json`
3. Extract unique keys by comparing against lock files
4. Count characters for cost estimation
5. Translate via JsonDeepL API
6. Create/update lock files for state tracking
7. Merge translations into target locale files
8. Clean up orphaned keys

### Configuration System (src/config.ts)
- Auto-creates `jsondeepl/config.json` with `defaultConfig` on first run
- Validates API keys by querying the JsonDeepL user endpoint during startup
- Calls the user-check helper with the API key and expected character count (e.g. `useUser(apiKey, 0)`) and validates returned fields (`user_id`, `isActive`, `credit_balance`)
- Exits early when the API key is invalid, the account is inactive, or there are insufficient credits
- Uses `consola.prompt()` for interactive confirmation when `options.prompt: true`

### State Management Pattern
- **Lock files**: `jsondeepl/{source}-lock.json` tracks last translated state
- **History**: `jsondeepl/history/{timestamp}/{lang}.json` stores each translation job (timestamp format created via `formattedNewDate()`)
- **Helpers**: `useStateCheck()` initializes lock/history files when missing and `formattedNewDate()` formats history folder names
- **Extraction logic**: `useExtract()` (and `extractUniqueKeys()`) compares current vs lock file to find changed keys
- **Merging**: `useMerging()` and `mergeFiles()` perform a deep merge that preserves non-conflicting entries

### File Structure Conventions
```
jsondeepl/
├── config.json              # Main configuration
├── {source}-lock.json        # State tracking per source locale
└── history/
    └── {timestamp}/          # Each translation job
        ├── en.json
        ├── fr.json
        └── ...
```

## Development Patterns

### TypeScript Configuration
- **Target**: `esnext` with `nodenext` module resolution
- **Strict mode**: Enabled with `noUncheckedIndexedAccess`
- **No emit**: Uses external build tools (obuild)
- **File extensions**: Use `.ts` imports, obuild handles conversion

### Error Handling & UX
- Use `consola` for all user output (start, success, error, warn, info)
- Call `process.exit(1)` for fatal errors, `process.exit(0)` for clean cancellation
- Validate configuration and API connectivity before processing
- Show character counts and cost estimates before translation

### API Integration
- Translation endpoint: `https://api.jsondeepl.com/v1/cli` (used by `useTranslateJSON`)
- User/credits endpoint: `https://api.jsondeepl.com/v1/cli-user` (used by `useUser`)
- Uses `ofetch` for HTTP requests
- Handles nested JSON objects recursively and saves per-language results under `jsondeepl/history/{timestamp}`

### Language Code Types
- **Source**: `SourceLanguageCode` (includes 'en', 'pt')
- **Target**: `TargetLanguageCode[]` (includes regional variants like 'en-GB', 'pt-BR')
- **AI engine**: Supports extensive `AiLangCodes` list with regional variants

## Essential Commands

### Development
```bash
npm run dev          # Run tests in watch mode
npm run build        # Build with obuild
npm run test         # Run full test suite (lint + types + vitest)
npm run lint:fix     # Auto-fix ESLint issues and update README
```

### Build System
- **obuild**: Builds single entry point `src/index.ts` → `dist/index.mjs`
- **Exports**: Uses `package.json` exports field pointing to `dist/index.mjs`
- **Types**: Generated as `dist/index.d.mts`

### Testing & Quality
- **Vitest**: Test runner with coverage via `@vitest/coverage-v8`
- **ESLint**: Uses `@antfu/eslint-config` with library preset
- **TypeScript**: Type checking with `tsc --noEmit --skipLibCheck`

## Code Conventions

### Utility Functions
- Prefix with `use` for main workflow functions (`useExtract`, `useCleanup`)
- Use `async function` declarations for all main functions
- Include JSDoc for complex utility functions (see `parseJsonFile`, `extractUniqueKeys`)

### File Operations
- Always use `ensureDirectoryExistence()` before writing files
- Use `pathe` for cross-platform path operations (`resolve`, `join`, `dirname`)
- Prefer `fs.promises` for async operations, `fs.writeFileSync` for simple writes

### Deep Object Processing
- `extractUniqueKeys()`: Recursively compares nested objects
- `mergeFiles()`: Deep merge strategy preserving non-conflicting entries
- `useCount()`: Recursively counts string characters in nested objects

## Key Dependencies
- **consola**: Interactive CLI prompts and styled output
- **ofetch**: HTTP client for API communication
- **pathe**: Cross-platform path utilities
- **obuild**: Zero-config TypeScript builder
- **@antfu/eslint-config**: Opinionated ESLint configuration

## Testing Strategy
- Tests are minimal (placeholder in `test/index.test.ts`)
- Focus on integration testing via `pnpm dev` command
- Manual testing with real API keys and translation workflows

## Release & Deployment

### Release Process
```bash
npm run release     # Runs full test suite, generates changelog, publishes to npm, and pushes git tags
```

### Release Workflow
1. **Automated testing**: `npm run test` (lint + type check + vitest coverage)
2. **Changelog generation**: Uses `changelogen` to auto-generate changelog from commits
3. **Version bumping**: Updates package.json version
4. **NPM publishing**: Publishes to `@jsondeepl/cli` on npmjs.com
5. **Git tagging**: Pushes version tags with `--follow-tags`

### Pre-release Hooks
- **prepack**: Runs `npm run build` to ensure dist files are current
- **Lint fixing**: `npm run lint:fix` runs `automd` for README updates + ESLint fixes

### Package Distribution
- **Global CLI**: Installed via `npm i -g @jsondeepl/cli`
- **Entry point**: `dist/index.mjs` (ESM format)
- **Binary name**: `jsondeepl` command available globally after install

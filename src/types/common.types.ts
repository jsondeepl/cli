import type { SourceLanguageCode, TargetLanguageCode, Usage } from 'deepl-node'

// Re-exported from deepl-node so the CLI's supported language list always
// matches the deepl-node version actually installed, instead of a hand-copied snapshot.
export type { SourceLanguageCode, TargetLanguageCode } from 'deepl-node'

export type ConfigOptions = {
  source: SourceLanguageCode
  target: TargetLanguageCode[]
  langDir: string
  formality?: 'prefer_more' | 'prefer_less'
  options: {
    prompt: boolean
  }
}

export type Config = ConfigOptions & {
  /** Your own DeepL API key, from https://www.deepl.com/en/your-account/keys */
  apiKey: string
  /** Usage fetched while validating the API key, reused to avoid a redundant DeepL call. */
  usage?: Usage
}

export type JsonFileObject = {
  [key: string]: string | JsonFileObject
}
